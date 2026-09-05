import type { SuiGrpcClient } from '@mysten/sui/grpc';

import type { ClaimCheckResult } from '../../../shared/contracts';
import type { Environment } from '../config';
import { assessClaimWithBothModels } from './assess-claim';
import { retrieveEvidence } from './newsapi';
import { recordClaimCheckOnChain } from './on-chain';
import { combineVerdict, truthScoreForVerdict } from './verdict';

/**
 * The full AI Fact Checker pipeline for one claim:
 *   1. Retrieve real evidence (NewsAPI) - the only source of truth used.
 *   2. Two independent Gonka models each read that evidence and give a stance.
 *   3. Deterministic code combines the stances into a verdict (never an LLM call).
 *   4. The verdict is optionally recorded on Sui as a public, auditable event.
 *
 * Never asks a model to answer from memory - see server/src/factcheck/assess-claim.ts.
 */
export async function checkClaim(
  env: Environment,
  suiClient: SuiGrpcClient,
  claim: string,
): Promise<ClaimCheckResult> {
  const { evidence, error: retrievalError } = await retrieveEvidence(env, claim);

  const modelReads =
    evidence.length > 0
      ? await assessClaimWithBothModels(env, claim, evidence)
      : ([] as ClaimCheckResult['modelReads']);

  const verdict = combineVerdict(evidence.length, modelReads);
  const truthScore = truthScoreForVerdict(verdict);

  const onChain = await recordClaimCheckOnChain(env, suiClient, claim, verdict, evidence.length);

  if (retrievalError && evidence.length === 0) {
    console.warn(`[factcheck] evidence retrieval failed: ${retrievalError}`);
  }

  return { claim, verdict, truthScore, evidence, modelReads, onChain };
}
