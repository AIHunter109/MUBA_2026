import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';

import { prisma } from '../db';
import { resolveUserId } from '../recipients/store';

type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export type RecurringRuleDto = {
  id: string;
  recipientName: string;
  recipientAddress: string;
  amount: string;
  asset: 'USDC' | 'SUI';
  frequency: RecurringFrequency;
  nextTriggerAt: string;
};

export class RecurringRuleError extends Error {}

function nextTriggerAt(frequency: RecurringFrequency, monthlyDay: number): Date {
  const next = new Date();
  next.setHours(9, 0, 0, 0);
  if (frequency === 'DAILY') {
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (frequency === 'WEEKLY') {
    next.setDate(next.getDate() + 7);
    return next;
  }
  if (frequency === 'BIWEEKLY') {
    next.setDate(next.getDate() + 14);
    return next;
  }
  next.setDate(monthlyDay);
  if (next <= new Date()) {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function validate(input: { recipient: string; amount: string; asset: string; frequency: string }): {
  recipient: string;
  amount: string;
  asset: 'USDC' | 'SUI';
  frequency: RecurringFrequency;
} {
  if (!isValidSuiAddress(input.recipient.trim())) throw new RecurringRuleError('recipient must be a valid Sui address');
  if (!/^\d+(?:\.\d+)?$/.test(input.amount.trim()) || Number(input.amount) <= 0) throw new RecurringRuleError('amount must be a positive decimal');
  if (input.asset !== 'USDC' && input.asset !== 'SUI') throw new RecurringRuleError('asset must be USDC or SUI');
  if (!['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'].includes(input.frequency)) throw new RecurringRuleError('frequency must be DAILY, WEEKLY, BIWEEKLY or MONTHLY');
  return { recipient: normalizeSuiAddress(input.recipient.trim()), amount: input.amount.trim(), asset: input.asset, frequency: input.frequency as RecurringFrequency };
}

function toDto(row: { id: string; amount: { toString(): string }; asset: string; frequency: string; nextTriggerAt: Date; recipient: { name: string; address: string } }): RecurringRuleDto {
  return { id: row.id, recipientName: row.recipient.name, recipientAddress: row.recipient.address, amount: row.amount.toString(), asset: row.asset as 'USDC' | 'SUI', frequency: row.frequency as RecurringFrequency, nextTriggerAt: row.nextTriggerAt.toISOString() };
}

export async function saveRecurringRule(input: { owner: string; recipientName: string; recipient: string; amount: string; asset: string; frequency: string; monthlyDay: number | null }): Promise<RecurringRuleDto> {
  const userId = await resolveUserId(input.owner);
  const valid = validate(input);
  const monthlyDay = input.monthlyDay ?? 1;
  let recipient = await prisma.recipient.findFirst({ where: { userId, address: valid.recipient } });
  if (!recipient) {
    const name = input.recipientName.trim().replace(/\s+/g, ' ').slice(0, 40) || `Wallet ${valid.recipient.slice(-6)}`;
    recipient = await prisma.recipient.create({ data: { userId, name, address: valid.recipient } });
  }
  const existing = await prisma.recurringRule.findFirst({ where: { userId, recipientId: recipient.id, frequency: valid.frequency, status: 'ACTIVE' }, orderBy: { updatedAt: 'desc' } });
  const data = { amount: valid.amount, asset: valid.asset, monthlyDay, timezone: 'UTC', nextTriggerAt: nextTriggerAt(valid.frequency, monthlyDay), status: 'ACTIVE', note: null };
  const row = existing
    ? await prisma.recurringRule.update({ where: { id: existing.id }, data, include: { recipient: true } })
    : await prisma.recurringRule.create({ data: { userId, recipientId: recipient.id, frequency: valid.frequency, ...data }, include: { recipient: true } });
  return toDto(row);
}

export async function listRecurringRules(owner: string): Promise<RecurringRuleDto[]> {
  const userId = await resolveUserId(owner);
  const rows = await prisma.recurringRule.findMany({ where: { userId, status: 'ACTIVE' }, orderBy: { nextTriggerAt: 'asc' }, include: { recipient: true } });
  return rows.map(toDto);
}

export async function deleteRecurringRule(owner: string, id: string): Promise<void> {
  const userId = await resolveUserId(owner);
  await prisma.recurringRule.deleteMany({ where: { id, userId } });
}
