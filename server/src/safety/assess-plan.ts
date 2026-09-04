import type { IntentReview, ModelRead, ResolvedPlan } from '../../../shared/contracts';
import { assessIntent, type ConsensusConfig, type SavedRecipient } from './consensus';

/**
 * Deterministic-only review for a manually entered transfer (recipient picked
 * from the book or an address typed in). Skips the LLM parse but still runs the
 * same recipient-resolution and risk checks (first-time recipient, high amount).
 */
export function assessPlan(
  plan: ResolvedPlan,
  savedRecipients: SavedRecipient[],
  config: ConsensusConfig,
): Omit<IntentReview, 'modelReads'> {
  const synthetic: ModelRead = {
    role: 'parser',
    model: 'manual-entry',
    requestId: null,
    latencyMs: 0,
    ok: true,
    error: null,
    intent: {
      recipientReference: plan.recipientAddress,
      recipientLabel: null,
      amount: plan.amount,
      asset: plan.asset,
      frequency: plan.frequency,
      monthlyDay: plan.monthlyDay,
      note: plan.note,
      urgencyLanguage: false,
      scamPatternFlag: false,
      claimsToVerify: [],
      confidence: 1,
      rationale: 'Entered manually, not parsed from a message.',
    },
  };

  return assessIntent([synthetic], savedRecipients, config, false);
}
