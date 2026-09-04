import { createHash } from 'node:crypto';

import type { IntentReview, ResolvedPlan } from '../../../shared/contracts';
import type { Environment } from '../config';
import { assessIntent, type SavedRecipient } from './consensus';
import { fixtureReads, shouldUseFixtures } from './fixtures';
import { parseAndVerify } from './parse-intent';

export function hashPlan(plan: ResolvedPlan): string {
  const canonical = JSON.stringify([
    plan.recipientAddress.toLowerCase(),
    plan.amount,
    plan.asset,
    plan.frequency,
    plan.monthlyDay ?? 0,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/**
 * Full safety pipeline: two model reads (or fixtures), then deterministic
 * consensus + risk logic. Returns everything the review screen needs.
 */
export async function reviewMessage(
  env: Environment,
  message: string,
  savedRecipients: SavedRecipient[],
): Promise<IntentReview> {
  const useFixtures = shouldUseFixtures(env);
  const reads = useFixtures ? fixtureReads(env, message) : await parseAndVerify(env, message);

  const assessment = assessIntent(
    reads,
    savedRecipients,
    { highAmountThreshold: env.HIGH_AMOUNT_THRESHOLD_USDC },
    useFixtures,
  );

  return {
    ...assessment,
    planHash: assessment.plan ? hashPlan(assessment.plan) : null,
    modelReads: reads,
  };
}
