import type { ModelRead, ParsedIntent } from '../../../shared/contracts';
import type { Environment } from '../config';

/**
 * Deterministic stand-in for the Gonka parser + verifier, used when DEMO_MODE is
 * on or no GONKA_API_KEY is set. Keeps the demo reproducible and offline while
 * the real pipeline stays wired.
 */
export function shouldUseFixtures(env: Environment): boolean {
  return env.DEMO_MODE || !env.GONKA_API_KEY;
}

const AMOUNT_RE = /(\d+(?:\.\d+)?)\s*(usdc|sui)?/i;
const URGENT_RE = /\b(urgent|urgently|emergency|asap|right now|immediately|hospital|stranded|please help)\b/i;
const MONTHLY_RE = /\b(every month|each month|monthly|recurring)\b/i;
const THIS_MONTH_RE = /\bthis month\b/i;
const ADDRESS_RE = /0x[0-9a-fA-F]{3,64}/;
const NAME_RE = /\b(?:send|pay|transfer|give)\s+(?:to\s+)?([A-Z][a-z]+)\b/i;
const LABEL_RE =
  /\b(?:his|her|their|the)?\s*name(?:'s| is)\s+([A-Z][a-z]+)\b|\b(?:call|save|name)\s+(?:him|her|them|it|this wallet)?\s*(?:as\s+)?([A-Z][a-z]+)\b/i;

function extractLabel(message: string): string | null {
  const m = message.match(LABEL_RE);
  return (m?.[1] || m?.[2] || '').trim() || null;
}

function extractRecipient(message: string): string | null {
  const address = message.match(ADDRESS_RE);
  if (address) {
    return address[0];
  }
  const name = message.match(NAME_RE);
  if (name && !/^(the|an?|some|money|usdc|sui)$/i.test(name[1])) {
    return name[1];
  }
  return null;
}

function baseIntent(message: string): ParsedIntent {
  const amountMatch = message.match(AMOUNT_RE);
  const asset = /sui/i.test(message) ? 'SUI' : 'USDC';
  const urgency = URGENT_RE.test(message);

  return {
    recipientReference: extractRecipient(message),
    recipientLabel: extractLabel(message),
    amount: amountMatch ? Number(amountMatch[1]) : null,
    asset: amountMatch ? asset : null,
    frequency: MONTHLY_RE.test(message) ? 'MONTHLY' : 'ONE_TIME',
    monthlyDay: null,
    note: /for ([^.,]+)/i.exec(message)?.[1]?.trim().slice(0, 120) ?? null,
    urgencyLanguage: urgency,
    scamPatternFlag: urgency && /\b(hospital|accident|stranded|arrested|emergency)\b/i.test(message),
    claimsToVerify: urgency
      ? [/\b(hospital|accident|stranded|arrested)\b/i.exec(message)?.[0] ?? 'stated emergency'].filter(
          Boolean,
        )
      : [],
    confidence: urgency ? 0.78 : 0.93,
    rationale: urgency
      ? 'Transfer request wrapped in emergency framing; treat the reason as unverified.'
      : 'Straightforward transfer instruction with a clear recipient and amount.',
  };
}

export function fixtureReads(env: Environment, message: string): ModelRead[] {
  const parser = baseIntent(message);

  // Verifier drifts on ambiguous "this month" phrasing to demonstrate DISPUTED.
  const verifier: ParsedIntent = {
    ...parser,
    frequency: THIS_MONTH_RE.test(message) && !MONTHLY_RE.test(message) ? 'MONTHLY' : parser.frequency,
    confidence: Math.max(0, parser.confidence - 0.1),
    rationale: 'Independent re-read of the same message.',
  };

  return [
    {
      role: 'parser',
      model: `${env.GONKA_PARSER_MODEL} (fixture)`,
      requestId: 'fixture-parser',
      latencyMs: 12,
      ok: true,
      error: null,
      intent: parser,
    },
    {
      role: 'verifier',
      model: `${env.GONKA_VERIFIER_MODEL} (fixture)`,
      requestId: 'fixture-verifier',
      latencyMs: 14,
      ok: true,
      error: null,
      intent: verifier,
    },
  ];
}
