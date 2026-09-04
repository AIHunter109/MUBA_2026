import type { ModelRead, ParsedIntent } from '../../../shared/contracts';
import type { Environment } from '../config';

/**
 * Deterministic stand-in for the Gonka parser + verifier, used when DEMO_MODE is
 * on or no GONKA_API_KEY is set. Keeps the demo reproducible and offline while
 * the real pipeline stays wired. This is regex-based and deliberately simple -
 * the real LLM path in parse-intent.ts is far more reliable at reading names.
 */
export function shouldUseFixtures(env: Environment): boolean {
  return env.DEMO_MODE || !env.GONKA_API_KEY;
}

const AMOUNT_RE = /(\d+(?:\.\d+)?)\s*(usdc|sui)?/i;
const URGENT_RE = /\b(urgent|urgently|emergency|asap|right now|immediately|hospital|stranded|please help)\b/i;
const MONTHLY_RE = /\b(every month|each month|monthly|recurring)\b/i;
const THIS_MONTH_RE = /\bthis month\b/i;
const ADDRESS_RE = /0x[0-9a-fA-F]{3,64}/;

// Case-sensitive on purpose: capitalization is the only signal that separates a
// name from an ordinary word, so these never carry the /i flag.
const CAP_WORD_RE = /^[A-Z][a-z]+$/;
const STOPWORDS = new Set(['The', 'An', 'A', 'Some', 'Money', 'Usdc', 'Sui', 'To', 'For']);
const NAME_TRIGGER_RE = /\b(?:send|pay|transfer|give)\s+(?:to\s+)?/i;
const LABEL_TRIGGER_RE =
  /\b(?:his|her|their|the)?\s*name(?:'s| is)\s+|\b(?:call|save|name)\s+(?:him|her|them|it|this wallet)?\s*(?:as\s+)?/i;

/** Reads up to 3 consecutive Capitalized words starting right after `trigger` matches. */
function captureNameAfter(message: string, trigger: RegExp): string | null {
  const match = trigger.exec(message);
  if (!match) {
    return null;
  }
  const rest = message.slice(match.index + match[0].length);
  const words: string[] = [];
  for (const raw of rest.trim().split(/\s+/)) {
    const word = raw.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
    if (words.length < 3 && CAP_WORD_RE.test(word) && !STOPWORDS.has(word)) {
      words.push(word);
    } else {
      break;
    }
  }
  return words.length > 0 ? words.join(' ') : null;
}

function baseIntent(message: string): ParsedIntent {
  const amountMatch = message.match(AMOUNT_RE);
  const asset = /sui/i.test(message) ? 'SUI' : 'USDC';
  const urgency = URGENT_RE.test(message);

  const address = message.match(ADDRESS_RE)?.[0] ?? null;
  const spokenName = captureNameAfter(message, NAME_TRIGGER_RE);
  const explicitLabel = captureNameAfter(message, LABEL_TRIGGER_RE);

  // "Send Mum 100 USDC" -> the spoken name IS the recipient (a lookup key).
  // "Send Rou Xuen 0.1 SUI to 0xabc" -> the address is the recipient, and the
  // name spoken alongside it becomes the label for a brand-new recipient.
  const recipientReference = address ?? spokenName;
  const recipientLabel = explicitLabel ?? (address && spokenName ? spokenName : null);

  return {
    recipientReference,
    recipientLabel,
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
