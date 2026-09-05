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
    where: { digest: input.digest },
    create: {
      userId,
      recipientId: recipient?.id,
      recipientAddress,
      amount,
      asset,
      status: 'success',
      digest: input.digest,
      network: input.network,
    },
    update: {},
  });

  return {
    digest: row.digest as string,
    recipient: row.recipientAddress ?? recipientAddress,
    recipientName: recipient?.name,
    amount: row.amount.toString(),
    asset: row.asset as 'USDC' | 'SUI',
    status: 'success',
    occurredAt: row.createdAt.toISOString(),
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
    }));
}

export function isTransactionStoreError(error: unknown): error is TransactionError | RecipientError {
  return error instanceof TransactionError || error instanceof RecipientError;
}
