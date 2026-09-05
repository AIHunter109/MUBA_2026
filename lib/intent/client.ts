import type { Signer } from '@mysten/sui/cryptography';
import { fromBase64 } from '@mysten/sui/utils';

import type { ClaimCheckResult, IntentReview, ResolvedPlan } from '@/shared/contracts';
import { apiPost } from '@/lib/sui/api';

export type TransferOutcome = { digest: string; status: 'success' | 'failure'; error?: string };

/** Natural-language path: two models parse, deterministic code decides. */
export function parseMessage(owner: string, message: string): Promise<IntentReview> {
  return apiPost<IntentReview>('/v1/intent/parse', { owner, message });
}

/**
 * The AI Fact Checker "extra security layer": retrieves real evidence for one
 * claim mentioned in the message, has two Gonka models read it, and returns a
 * deterministic verdict plus (if configured) a link to the on-chain record.
 */
export function checkClaim(claim: string): Promise<ClaimCheckResult> {
  return apiPost<ClaimCheckResult>('/v1/intent/check-claim', { claim });
}

/** Manual path: deterministic checks only (first-time recipient, high amount). */
export function assessManualPlan(owner: string, plan: ResolvedPlan): Promise<IntentReview> {
  return apiPost<IntentReview>('/v1/intent/assess', { owner, plan });
}

/**
 * The only way money moves. The server builds the PTB from the reviewed plan and
 * mints a single-use token bound to those exact bytes; we sign locally; the
 * server verifies the token against the bytes before it submits.
 */
export async function confirmAndExecute(signer: Signer, plan: ResolvedPlan): Promise<TransferOutcome> {
  const { confirmationToken, transactionBytes } = await apiPost<{
    confirmationToken: string;
    transactionBytes: string;
  }>('/v1/intent/confirm', { sender: signer.toSuiAddress(), plan });

  const { signature } = await signer.signTransaction(fromBase64(transactionBytes));

  return apiPost<TransferOutcome>('/v1/intent/execute', {
    confirmationToken,
    transactionBytes,
    signature,
  });
}
