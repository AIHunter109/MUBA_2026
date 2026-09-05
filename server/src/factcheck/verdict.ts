import type { ClaimModelRead, ClaimVerdict } from '../../../shared/contracts';

/**
 * Deterministic combiner - no LLM call happens here. This is the single place
 * that decides SUPPORTED / CONTRADICTED / DISPUTED / UNVERIFIABLE, mirroring
 * the "AI reasons, rules calculate" principle used for the payment safety
 * verdict (server/src/safety/consensus.ts).
 *
 * Zero retrieved evidence is a hard override to UNVERIFIABLE regardless of
 * what any model says - a model has no basis to have an opinion with no
 * evidence in front of it, so its stance is discarded in that case.
 */
export function combineVerdict(evidenceCount: number, reads: ClaimModelRead[]): ClaimVerdict {
  if (evidenceCount === 0) {
    return 'UNVERIFIABLE';
  }

  const stances = reads.filter((r) => r.ok && r.stance != null).map((r) => r.stance);
  const supports = stances.filter((s) => s === 'supports').length;
  const contradicts = stances.filter((s) => s === 'contradicts').length;

  if (stances.length === 0) {
    // Evidence exists but no model could read it - treat as unresolved, not silence.
    return 'UNVERIFIABLE';
  }
  if (supports > 0 && contradicts > 0) {
    return 'DISPUTED';
  }
  if (supports > 0) {
    return 'SUPPORTED';
  }
  if (contradicts > 0) {
    return 'CONTRADICTED';
  }
  // Everything left is "unclear".
  return 'UNVERIFIABLE';
}

/** A 0-100 restatement of the verdict for the Gonka brief's "Truth Score" framing. Not an independent signal. */
export function truthScoreForVerdict(verdict: ClaimVerdict): number {
  switch (verdict) {
    case 'SUPPORTED':
      return 85;
    case 'CONTRADICTED':
      return 15;
    case 'DISPUTED':
      return 50;
    case 'UNVERIFIABLE':
      return 50;
  }
}
