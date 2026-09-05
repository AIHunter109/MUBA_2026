import { z } from 'zod';

import type { ClaimEvidence, ClaimModelRead, ClaimStance } from '../../../shared/contracts';
import type { Environment } from '../config';
import { callGonka, GonkaError } from '../gonka/client';
import { extractJsonObject } from '../gonka/extract-json';

const SYSTEM_PROMPT = `You are a careful fact-checking assistant. You will be given ONE claim and a numbered list of real news articles retrieved for it a moment ago.

Rules:
- Base your answer ONLY on the articles given. You have no memory of current events and no live access - do not use anything you "know" independently of the articles.
- If the articles do not clearly address the claim, say "unclear" - never guess.
- "stance": "supports" if the articles corroborate the claim, "contradicts" if they refute it, "unclear" if they don't clearly settle it either way.
- "citedEvidenceIndex": the number (1-based) of the single article your stance rests on most, or null if none applies clearly.
- "rationale": one or two sentences, plain language, referencing what the cited article actually says.
- Output ONLY a single minified JSON object, no prose, no markdown fences, no <think>.

Schema:
{"stance":"supports"|"contradicts"|"unclear","citedEvidenceIndex":number|null,"rationale":string}`;

const claimAssessmentSchema = z.object({
  stance: z.enum(['supports', 'contradicts', 'unclear']),
  citedEvidenceIndex: z.number().int().positive().nullable(),
  rationale: z.string().max(600),
});

function buildUserPrompt(claim: string, evidence: ClaimEvidence[]): string {
  const list = evidence
    .map((e, i) => `${i + 1}. "${e.title}" (${e.source}${e.publishedAt ? `, ${e.publishedAt}` : ''})\n${e.snippet}`)
    .join('\n\n');
  return `Claim: "${claim}"\n\nRetrieved articles:\n${list}`;
}

function coerceAssessment(value: unknown): { stance: ClaimStance; citedEvidenceIndex: number | null; rationale: string } | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const normalized = {
    stance: typeof raw.stance === 'string' ? raw.stance.toLowerCase() : null,
    citedEvidenceIndex:
      raw.citedEvidenceIndex == null || raw.citedEvidenceIndex === false
        ? null
        : Number(raw.citedEvidenceIndex),
    rationale: typeof raw.rationale === 'string' ? raw.rationale.slice(0, 600) : '',
  };
  const parsed = claimAssessmentSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
}

/**
 * Has one Gonka model read the retrieved evidence and give a stance on the
 * claim. Never called with an empty evidence list - the caller's deterministic
 * UNVERIFIABLE override handles that case before any model is asked.
 */
export async function assessClaim(
  env: Environment,
  claim: string,
  evidence: ClaimEvidence[],
  role: ClaimModelRead['role'],
  model: string,
): Promise<ClaimModelRead> {
  try {
    const result = await callGonka(env, {
      model,
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(claim, evidence),
      maxTokens: 500,
    });
    const assessment = coerceAssessment(extractJsonObject(result.text));
    return {
      role,
      model,
      requestId: result.requestId,
      latencyMs: result.latencyMs,
      ok: assessment !== null,
      error: assessment === null ? 'Model output did not match the assessment schema' : null,
      stance: assessment?.stance ?? null,
      rationale: assessment?.rationale ?? null,
      citedEvidenceIndex:
        assessment?.citedEvidenceIndex != null && assessment.citedEvidenceIndex <= evidence.length
          ? assessment.citedEvidenceIndex
          : null,
    };
  } catch (error) {
    const message = error instanceof GonkaError ? error.message : error instanceof Error ? error.message : 'Unknown error';
    return {
      role,
      model,
      requestId: error instanceof GonkaError ? error.requestId : null,
      latencyMs: 0,
      ok: false,
      error: message,
      stance: null,
      rationale: null,
      citedEvidenceIndex: null,
    };
  }
}

/** Parser-model + verifier-model assessments in parallel, over the same evidence. */
export async function assessClaimWithBothModels(
  env: Environment,
  claim: string,
  evidence: ClaimEvidence[],
): Promise<ClaimModelRead[]> {
  return Promise.all([
    assessClaim(env, claim, evidence, 'parser', env.GONKA_PARSER_MODEL),
    assessClaim(env, claim, evidence, 'verifier', env.GONKA_VERIFIER_MODEL),
  ]);
}
