import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';

import { prisma } from '../db';

export class RecipientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipientError';
  }
}

export type RecipientDto = {
  id: string;
  name: string;
  address: string;
  createdAt: string;
};

/**
 * There is no real session yet (plan.md step 13). Identity is the wallet address:
 * we upsert a User keyed by an AuthIdentity(provider="wallet", sub=address) so the
 * schema's relations work today and slot into real auth later.
 */
export async function resolveUserId(walletAddress: string): Promise<string> {
  if (!isValidSuiAddress(walletAddress)) {
    throw new RecipientError('owner must be a valid Sui address');
  }
  const providerSub = normalizeSuiAddress(walletAddress);

  const existing = await prisma.authIdentity.findUnique({
    where: { provider_providerSub: { provider: 'wallet', providerSub } },
  });
  if (existing) {
    return existing.userId;
  }

  const user = await prisma.user.create({
    data: { identities: { create: { provider: 'wallet', providerSub } } },
  });
  return user.id;
}

function toDto(row: { id: string; name: string; address: string; createdAt: Date }): RecipientDto {
  return { id: row.id, name: row.name, address: row.address, createdAt: row.createdAt.toISOString() };
}

function validateName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length < 1 || clean.length > 40) {
    throw new RecipientError('Name must be 1 to 40 characters');
  }
  return clean;
}

function validateAddress(address: string): string {
  if (!isValidSuiAddress(address.trim())) {
    throw new RecipientError('That is not a valid Sui address');
  }
  return normalizeSuiAddress(address.trim());
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

export async function listRecipients(owner: string): Promise<RecipientDto[]> {
  const userId = await resolveUserId(owner);
  const rows = await prisma.recipient.findMany({ where: { userId }, orderBy: { name: 'asc' } });
  return rows.map(toDto);
}

export async function createRecipient(
  owner: string,
  name: string,
  address: string,
): Promise<RecipientDto> {
  const userId = await resolveUserId(owner);
  const cleanName = validateName(name);
  const cleanAddress = validateAddress(address);

  try {
    const row = await prisma.recipient.create({
      data: { userId, name: cleanName, address: cleanAddress },
    });
    return toDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RecipientError(`You already have a recipient named "${cleanName}"`);
    }
    throw error;
  }
}

export async function updateRecipient(
  owner: string,
  id: string,
  name: string,
  address: string,
): Promise<RecipientDto> {
  const userId = await resolveUserId(owner);
  const cleanName = validateName(name);
  const cleanAddress = validateAddress(address);

  const owned = await prisma.recipient.findFirst({ where: { id, userId } });
  if (!owned) {
    throw new RecipientError('Recipient not found');
  }

  const addressChanged = owned.address !== cleanAddress;
  try {
    const row = await prisma.recipient.update({
      where: { id },
      data: { name: cleanName, address: cleanAddress, walletChangedAt: addressChanged ? new Date() : owned.walletChangedAt },
    });
    return toDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RecipientError(`You already have a recipient named "${cleanName}"`);
    }
    throw error;
  }
}

export async function deleteRecipient(owner: string, id: string): Promise<void> {
  const userId = await resolveUserId(owner);
  const owned = await prisma.recipient.findFirst({ where: { id, userId } });
  if (!owned) {
    throw new RecipientError('Recipient not found');
  }
  await prisma.recipient.delete({ where: { id } });
}
