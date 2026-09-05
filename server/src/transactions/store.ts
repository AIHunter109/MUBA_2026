import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';

import { prisma } from '../db';
import { RecipientError, resolveUserId } from '../recipients/store';

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

export async function listTransactions(owner: string): Promise<TransactionDto[]> {
  const userId = await resolveUserId(owner);
  const [rows, recipients] = await Promise.all([prisma.transaction.findMany({
    where: { userId, status: 'success' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { recipient: { select: { address: true, name: true } } },
  }), prisma.recipient.findMany({ where: { userId }, select: { address: true, name: true } })]);
  const namesByAddress = new Map(recipients.map((recipient) => [recipient.address, recipient.name]));

  return rows
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
}

export function isTransactionStoreError(error: unknown): error is TransactionError | RecipientError {
  return error instanceof TransactionError || error instanceof RecipientError;
}
