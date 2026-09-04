import { parsedIntentSchema, type ModelRead, type ParsedIntent } from '../../../shared/contracts';
import type { Environment } from '../config';
import { callGonka, GonkaError } from '../gonka/client';
import { extractJsonObject } from '../gonka/extract-json';

const SYSTEM_PROMPT = `You read one short message from a person managing cross-border family remittances and extract a structured transfer intent.

Rules:
- Output ONLY a single minified JSON object. No prose, no markdown fences, no <think>.
- Do not invent a recipient, amount, or asset that is not in the message. Use null when unknown.
- "recipientReference" is what identifies the recipient: a saved name ("Mum", "Dad") OR a wallet address ("0x..."). If the message gives BOTH an address and a name for a new person, put the ADDRESS here.
- "recipientLabel" is a name the message assigns to a NEW recipient, e.g. "his name is John", "save him as John", "this is Dad's new wallet". Null if the message does not name a new recipient.
- "asset" is "USDC" or "SUI" or null. "frequency" is "ONE_TIME" or "MONTHLY" or null.
- "urgencyLanguage": true if the message pressures speed or uses emergency framing.
- "scamPatternFlag": true if the narrative matches a common social-engineering / emergency-scam script.
- "claimsToVerify": short list of factual claims a human would need to check (e.g. "sister is in hospital"). Do NOT try to verify them.
- "confidence": your confidence in the extraction, 0 to 1.
- "rationale": one sentence, plain language.

Schema:
{"recipientReference":string|null,"recipientLabel":string|null,"amount":number|null,"asset":"USDC"|"SUI"|null,"frequency":"ONE_TIME"|"MONTHLY"|null,"monthlyDay":number|null,"note":string|null,"urgencyLanguage":boolean,"scamPatternFlag":boolean,"claimsToVerify":string[],"confidence":number,"rationale":string}`;

function coerceIntent(value: unknown): ParsedIntent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;

  // Normalize a few shapes models drift into before strict validation.
  const normalized = {
    recipientReference: emptyToNull(raw.recipientReference ?? raw.recipient),
    recipientLabel: emptyToNull(raw.recipientLabel ?? raw.recipientName)?.slice(0, 40) ?? null,
    amount: typeof raw.amount === 'string' ? Number(raw.amount) : (raw.amount ?? null),
    asset: upperOrNull(raw.asset),
    frequency: normalizeFrequency(raw.frequency),
    monthlyDay: raw.monthlyDay == null ? null : Number(raw.monthlyDay),
    note: emptyToNull(raw.note),
    urgencyLanguage: Boolean(raw.urgencyLanguage),
    scamPatternFlag: Boolean(raw.scamPatternFlag),
    claimsToVerify: Array.isArray(raw.claimsToVerify)
      ? raw.claimsToVerify.filter((c): c is string => typeof c === 'string').slice(0, 10)
      : [],
    confidence: clamp01(typeof raw.confidence === 'string' ? Number(raw.confidence) : raw.confidence),
    rationale: typeof raw.rationale === 'string' ? raw.rationale.slice(0, 600) : '',
  };

  const parsed = parsedIntentSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
}

/** Runs one model and returns a normalized ModelRead (never throws). */
export async function readIntent(
  env: Environment,
  message: string,
  role: ModelRead['role'],
  model: string,
): Promise<ModelRead> {
  try {
    const result = await callGonka(env, {
      model,
      system: SYSTEM_PROMPT,
      user: message,
      maxTokens: 700,
    });
    const intent = coerceIntent(extractJsonObject(result.text));
    return {
      role,
      model,
      requestId: result.requestId,
      latencyMs: result.latencyMs,
      ok: intent !== null,
      error: intent === null ? 'Model output did not match the intent schema' : null,
      intent,
    };
  } catch (error) {
    const message_ =
      error instanceof GonkaError ? error.message : error instanceof Error ? error.message : 'Unknown error';
    return {
      role,
      model,
      requestId: error instanceof GonkaError ? error.requestId : null,
      latencyMs: 0,
      ok: false,
      error: message_,
      intent: null,
    };
  }
}

/** Parser + verifier in parallel. */
export async function parseAndVerify(env: Environment, message: string): Promise<ModelRead[]> {
  return Promise.all([
    readIntent(env, message, 'parser', env.GONKA_PARSER_MODEL),
    readIntent(env, message, 'verifier', env.GONKA_VERIFIER_MODEL),
  ]);
}

function emptyToNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function upperOrNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const upper = value.trim().toUpperCase();
  return upper === 'USDC' || upper === 'SUI' ? upper : null;
}

function normalizeFrequency(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const v = value.trim().toUpperCase().replace(/[\s-]/g, '_');
  if (v === 'ONE_TIME' || v === 'ONCE' || v === 'SINGLE') {
    return 'ONE_TIME';
  }
  if (v === 'MONTHLY' || v === 'RECURRING' || v === 'EVERY_MONTH') {
    return 'MONTHLY';
  }
  return null;
}

function clamp01(value: unknown): number {
  const n = typeof value === 'number' ? value : 0;
  if (Number.isNaN(n)) {
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}
