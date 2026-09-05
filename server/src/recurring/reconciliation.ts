import { prisma } from '../db';
import { resolveUserId } from '../recipients/store';
import { advanceTrigger, type RecurringFrequency } from './store';

export class ReconciliationError extends Error {}

export type DueRecurringRule = {
  id: string;
  recipientName: string;
  recipientAddress: string;
  amount: string;
  asset: 'USDC' | 'SUI';
  frequency: string;
  nextTriggerAt: string;
  /**
   * 'due' - nothing sent to this recipient since the last cycle, safe to prompt
   * a normal send.
   * 'needs_reconciliation' - a manual transfer to the same recipient already
   * happened this window (deterministic log match, not AI-guessed) - the UI
   * must ask send anyway / skip / adjust rather than treating this as a plain
   * due payment.
   */
  status: 'due' | 'needs_reconciliation';
  matchedManualTransferAt?: string;
};

/**
 * Every rule whose scheduled date has arrived, each checked against the
 * transaction log for a manual transfer to the same recipient since it was
 * last triggered (or created, if never triggered). This is the "does not
 * auto-fire on top of a manual send" safeguard - a deterministic query, never
 * an AI guess, matched on recipient + time window (not exact amount, since a
 * parent might reasonably send a different amount for unrelated reasons).
 */
export async function listDueRecurringRules(owner: string): Promise<DueRecurringRule[]> {
  const userId = await resolveUserId(owner);
  const now = new Date();

  const dueRules = await prisma.recurringRule.findMany({
    where: { userId, status: 'ACTIVE', nextTriggerAt: { lte: now } },
    orderBy: { nextTriggerAt: 'asc' },
    include: { recipient: true },
  });

  return Promise.all(
    dueRules.map(async (rule): Promise<DueRecurringRule> => {
      const windowStart = rule.lastTriggeredAt ?? rule.createdAt;
      const manualMatch = await prisma.transaction.findFirst({
        where: {
          userId,
          recipientAddress: rule.recipient.address,
          status: 'success',
          createdAt: { gt: windowStart },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (manualMatch) {
        await prisma.reconciliationPrompt.upsert({
          where: { id: `${rule.id}:${windowStart.toISOString()}` },
          create: {
            id: `${rule.id}:${windowStart.toISOString()}`,
            userId,
            recurringRuleId: rule.id,
            matchedAt: manualMatch.createdAt,
            windowStart,
            windowEnd: now,
            status: 'PENDING',
          },
          update: {},
        });
      }

      return {
        id: rule.id,
        recipientName: rule.recipient.name,
        recipientAddress: rule.recipient.address,
        amount: rule.amount.toString(),
        asset: rule.asset as 'USDC' | 'SUI',
        frequency: rule.frequency,
        nextTriggerAt: rule.nextTriggerAt.toISOString(),
        status: manualMatch ? 'needs_reconciliation' : 'due',
        matchedManualTransferAt: manualMatch?.createdAt.toISOString(),
      };
    }),
  );
}

async function resolvePendingPrompt(userId: string, ruleId: string, resolution: string): Promise<void> {
  await prisma.reconciliationPrompt.updateMany({
    where: { userId, recurringRuleId: ruleId, status: 'PENDING' },
    data: { status: 'RESOLVED', resolution },
  });
}

/**
 * The user sent this cycle's payment (on schedule or adjusted) via the normal
 * send flow - advance the rule to its next occurrence and close out any open
 * reconciliation prompt. Does not itself move money; call after a transfer
 * has already settled.
 */
export async function markRecurringRuleTriggered(owner: string, id: string): Promise<void> {
  const userId = await resolveUserId(owner);
  const rule = await prisma.recurringRule.findFirst({ where: { id, userId } });
  if (!rule) {
    throw new ReconciliationError('Recurring rule not found');
  }
  const next = advanceTrigger(rule.nextTriggerAt, rule.frequency as RecurringFrequency, rule.monthlyDay);
  await prisma.recurringRule.update({
    where: { id },
    data: { nextTriggerAt: next, lastTriggeredAt: new Date() },
  });
  await resolvePendingPrompt(userId, id, 'sent');
}

/** "Skip this month" - resets to the next trigger date only, no catch-up logic. */
export async function skipRecurringRule(owner: string, id: string): Promise<void> {
  const userId = await resolveUserId(owner);
  const rule = await prisma.recurringRule.findFirst({ where: { id, userId } });
  if (!rule) {
    throw new ReconciliationError('Recurring rule not found');
  }
  const next = advanceTrigger(rule.nextTriggerAt, rule.frequency as RecurringFrequency, rule.monthlyDay);
  await prisma.recurringRule.update({
    where: { id },
    data: { nextTriggerAt: next, lastTriggeredAt: new Date() },
  });
  await resolvePendingPrompt(userId, id, 'skipped');
}
