import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';

import type { Environment } from '../config';
import { prisma } from '../db';
import { RecipientError, resolveUserId } from '../recipients/store';
import { listOnChainReceivedTransfers } from './on-chain';

export class TransactionError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type TransactionDto = {
  digest: string;
  recipient: string;
  recipientName?: string;
  amount: string;
  asset: 'USDC' | 'SUI';
  status: 'success';
  occurredAt: string;
  direction: 'SENT' | 'RECEIVED';
};

function validateAmount(amount: string): string {
  const clean = amount.trim();
  if (!/^\d+(?:\.\d+)?$/.test(clean) || Number(clean) <= 0) {
    throw new TransactionError('amount must be a positive decimal');
  }
  return clean;
}

function validateAsset(asset: string): 'USDC' | 'SUI' {
  if (asset === 'USDC' || asset === 'SUI') {
    return asset;
  }
  throw new TransactionError('asset must be USDC or SUI');
}

function validateRecipient(address: string): string {
  if (!isValidSuiAddress(address.trim())) {
    throw new TransactionError('recipient must be a valid Sui address');
  }
  return normalizeSuiAddress(address.trim());
}

export async function recordSettledTransaction(input: {
  owner: string;
  digest: string;
  recipient: string;
  amount: string;
  asset: string;
  network: string;
}): Promise<TransactionDto> {
  if (input.digest.trim().length < 1) {
    throw new TransactionError('digest is required');
  }
  const userId = await resolveUserId(input.owner);
  const recipientAddress = validateRecipient(input.recipient);
  const amount = validateAmount(input.amount);
  const asset = validateAsset(input.asset);
  const recipient = await prisma.recipient.findFirst({
    where: { userId, address: recipientAddress },
    select: { id: true, name: true },
  });

  const row = await prisma.transaction.upsert({
    where: { userId_digest: { userId, digest: input.digest } },
    create: {
      userId,
      recipientId: recipient?.id,
      recipientAddress,
      amount,
      asset,
      status: 'success',
      digest: input.digest,
      network: input.network,
      direction: 'SENT',
    },
    update: {},
  });

  // Best-effort mirror: if the recipient address itself belongs to a
  // RemitGuard user (an AuthIdentity already on file - we only look, never
  // create one the way resolveUserId would), record a matching RECEIVED row
  // in their own history so both sides of an in-app transfer see it. This
  // only covers RemitGuard-to-RemitGuard transfers; money arriving from
  // outside the app (another wallet, an exchange) is not detected here.
  const receiverIdentity = await prisma.authIdentity.findUnique({
    where: { provider_providerSub: { provider: 'wallet', providerSub: recipientAddress } },
  });
  if (receiverIdentity && receiverIdentity.userId !== userId) {
    const senderAddress = normalizeSuiAddress(input.owner.trim());
    const savedSenderContact = await prisma.recipient.findFirst({
      where: { userId: receiverIdentity.userId, address: senderAddress },
      select: { id: true },
    });
    await prisma.transaction.upsert({
      where: { userId_digest: { userId: receiverIdentity.userId, digest: input.digest } },
      create: {
        userId: receiverIdentity.userId,
        recipientId: savedSenderContact?.id,
        recipientAddress: senderAddress,
        amount,
        asset,
        status: 'success',
        digest: input.digest,
        network: input.network,
        direction: 'RECEIVED',
      },
      update: {},
    });
  }

  return {
    digest: row.digest as string,
    recipient: row.recipientAddress ?? recipientAddress,
    recipientName: recipient?.name,
    amount: row.amount.toString(),
    asset: row.asset as 'USDC' | 'SUI',
    status: 'success',
    occurredAt: row.createdAt.toISOString(),
    direction: row.direction as 'SENT' | 'RECEIVED',
  };
}

/**
 * `chain`, when given, adds a best-effort second source: real incoming
 * transfers detected directly on Sui (see transactions/on-chain.ts), merged
 * in alongside whatever this app itself recorded. This is what makes a
 * transfer sent from outside RemitGuard entirely - another wallet, an
 * exchange, or a friend running their own separate copy of this app with
 * their own database - still show up. A chain-read failure never breaks the
 * rest of the history; it just falls back to the app's own records.
 */
export async function listTransactions(
  owner: string,
  chain?: { client: SuiGrpcClient; environment: Environment },
): Promise<TransactionDto[]> {
  const userId = await resolveUserId(owner);
  const [rows, recipients] = await Promise.all([prisma.transaction.findMany({
    where: { userId, status: 'success' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { recipient: { select: { address: true, name: true } } },
  }), prisma.recipient.findMany({ where: { userId }, select: { id: true, address: true, name: true } })]);
  const namesByAddress = new Map(recipients.map((recipient) => [recipient.address, recipient.name]));
  const recipientIdByAddress = new Map(recipients.map((recipient) => [recipient.address, recipient.id]));

  const dbTransactions: TransactionDto[] = rows
    .filter((row): row is typeof row & { digest: string } => Boolean(row.digest))
    .map((row) => ({
      digest: row.digest,
      recipient: row.recipientAddress ?? row.recipient?.address ?? '',
      recipientName: row.recipient?.name ?? namesByAddress.get(row.recipientAddress ?? ''),
      amount: row.amount.toString(),
      asset: row.asset as 'USDC' | 'SUI',
      status: 'success' as const,
      occurredAt: row.createdAt.toISOString(),
      direction: (row.direction === 'RECEIVED' ? 'RECEIVED' : 'SENT') as 'SENT' | 'RECEIVED',
    }));

  if (!chain) {
    return dbTransactions;
  }

  const knownDigests = new Set(dbTransactions.map((t) => t.digest));
  let onChainTransactions: TransactionDto[] = [];
  try {
    const transfers = await listOnChainReceivedTransfers(chain.client, chain.environment, owner);
    const newTransfers = transfers.filter((t) => !knownDigests.has(t.digest));

    // Persist the moment a transfer is found, not just return it for this
    // request. Detection only works while the received coin is still unspent
    // and unmerged - once it is spent (the very next send, in practice), the
    // trail back to it is gone. Writing it to the database here means it
    // survives that: every future load reads it back as a normal recorded
    // transaction, regardless of what happens to the coin afterwards.
    await Promise.all(
      newTransfers.map((t) =>
        prisma.transaction
          .upsert({
            where: { userId_digest: { userId, digest: t.digest } },
            create: {
              userId,
              recipientId: recipientIdByAddress.get(t.from),
              recipientAddress: t.from,
              amount: t.amount,
              asset: t.asset,
              status: 'success',
              digest: t.digest,
              network: chain.environment.SUI_NETWORK,
              direction: 'RECEIVED',
              createdAt: new Date(t.occurredAt),
            },
            update: {},
          })
          .catch(() => {
            // A write failing for one transfer must not lose the others - it
            // will simply be detected (and this write retried) on the next load.
          }),
      ),
    );

    onChainTransactions = newTransfers.map((t) => ({
      digest: t.digest,
      recipient: t.from,
      recipientName: namesByAddress.get(t.from),
      amount: t.amount,
      asset: t.asset,
      status: 'success' as const,
      occurredAt: t.occurredAt,
      direction: 'RECEIVED' as const,
    }));
  } catch {
    // The app's own recorded history must still load if the chain read fails.
  }

  return [...dbTransactions, ...onChainTransactions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function isTransactionStoreError(error: unknown): error is TransactionError | RecipientError {
  return error instanceof TransactionError || error instanceof RecipientError;
}
