import type {
  IntentReview,
  ModelRead,
  ParsedIntent,
  ResolvedPlan,
  SafetyFlag,
  SafetyVerdict,
} from '../../../shared/contracts';

export type SavedRecipient = { name: string; address: string };

export type ConsensusConfig = {
  highAmountThreshold: number;
};

const SUI_ADDRESS_RE = /^0x[0-9a-fA-F]{1,64}$/;

/**
 * Deterministic risk + consensus logic. No LLM calls here. Takes both model
 * reads and turns them into a single verdict plus the exact plan that would
 * execute. Model disagreement is surfaced, never silently averaged.
 */
export function assessIntent(
  reads: ModelRead[],
  savedRecipients: SavedRecipient[],
  config: ConsensusConfig,
  demo: boolean,
): Omit<IntentReview, 'modelReads'> {
  const okReads = reads.filter((r): r is ModelRead & { intent: ParsedIntent } => r.ok && r.intent !== null);
  const flags: SafetyFlag[] = [];

  if (okReads.length === 0) {
    return {
      status: 'cannot_execute',
      verdict: 'DISPUTED',
      plan: null,
      planHash: null,
      flags: [
        {
          code: 'UNSUPPORTED_REQUEST',
          severity: 'warn',
          detail: 'Neither model could turn this message into a transfer. Rephrase it or use the manual form.',
        },
      ],
      demo,
    };
  }

  const primaryRead = okReads.find((r) => r.role === 'parser') ?? okReads[0];
  const primary = primaryRead.intent;
  const other = okReads.find((r) => r !== primaryRead)?.intent ?? null;

  // --- Material-field consensus -----------------------------------------------
  // A genuine conflict is when both models committed to a value and those values
  // differ. One model leaving a field null is "no opinion", not disagreement -
  // we take the other model's value and move on.
  let materialDisagreement = false;
  if (other) {
    const diffs: string[] = [];
    if (conflict(norm(primary.recipientReference) || null, norm(other.recipientReference) || null)) {
      diffs.push('recipient');
    }
    if (conflict(primary.amount, other.amount)) diffs.push('amount');
    if (conflict(primary.asset, other.asset)) diffs.push('asset');
    if (conflict(primary.frequency, other.frequency)) diffs.push('frequency');
    if (diffs.length > 0) {
      materialDisagreement = true;
      flags.push({
        code: 'MODEL_DISAGREEMENT',
        severity: 'warn',
        detail: `The two models read this differently on: ${diffs.join(', ')}. Check the plan carefully.`,
      });
    }
  }

  // Merge: primary's value, or the other model's where primary left a gap.
  const merged = {
    recipientReference: primary.recipientReference ?? other?.recipientReference ?? null,
    recipientLabel: primary.recipientLabel ?? other?.recipientLabel ?? null,
    amount: primary.amount ?? other?.amount ?? null,
    asset: primary.asset ?? other?.asset ?? null,
    frequency: primary.frequency ?? other?.frequency ?? null,
    monthlyDay: primary.monthlyDay ?? other?.monthlyDay ?? null,
    note: primary.note ?? other?.note ?? null,
  };

  // --- Recipient resolution --------------------------------------------------
  const ref = merged.recipientReference;
  const resolved = resolveRecipient(ref, savedRecipients, merged.recipientLabel);

  if (!resolved) {
    flags.push({
      code: 'RECIPIENT_UNRESOLVED',
      severity: 'warn',
      detail: ref
        ? `"${ref}" is not a saved recipient and is not a valid Sui address.`
        : 'No recipient was found in the message.',
    });
  } else if (!resolved.known) {
    flags.push({
      code: 'FIRST_TIME_RECIPIENT',
      severity: 'warn',
      detail: 'This address is not in your recipient book. First-time recipients carry more risk.',
    });
  }

  // --- Required fields ------------------------------------------------------
  const missing: string[] = [];
  if (merged.amount == null || merged.amount <= 0) missing.push('amount');
  if (merged.asset == null) missing.push('asset');
  const frequency = merged.frequency ?? 'ONE_TIME';
  if (missing.length > 0) {
    flags.push({
      code: 'MISSING_FIELDS',
      severity: 'warn',
      detail: `The message is missing: ${missing.join(', ')}.`,
    });
  }

  // --- Heuristic risk signals (model reads) -------------------------------
  const urgency = okReads.some((r) => r.intent.urgencyLanguage);
  const scamPattern = okReads.some((r) => r.intent.scamPatternFlag);
  const claims = dedupe(okReads.flatMap((r) => r.intent.claimsToVerify));

  if (scamPattern) {
    flags.push({
      code: 'SCAM_PATTERN',
      severity: 'warn',
      detail: 'A model flagged this narrative as matching a common emergency-scam script.',
    });
  }
  if (urgency) {
    flags.push({
      code: 'URGENCY_LANGUAGE',
      severity: scamPattern || (resolved && !resolved.known) ? 'warn' : 'info',
      detail: 'The message uses urgency or emergency framing. Scammers rely on time pressure.',
    });
  }
  if (claims.length > 0) {
    flags.push({
      code: 'UNVERIFIED_CLAIMS',
      severity: 'info',
      detail: `Unverified claims in the message: ${claims.join('; ')}. RemitGuard does not fact-check these.`,
    });
  }

  const amount = merged.amount ?? 0;
  if (resolved && amount > config.highAmountThreshold) {
    flags.push({
      code: 'HIGH_AMOUNT',
      severity: 'warn',
      detail: `${amount} is above your review threshold of ${config.highAmountThreshold}.`,
    });
  }

  // --- Build the executable plan ----------------------------------------
  const canExecute = resolved !== null && missing.length === 0;
  const plan: ResolvedPlan | null = canExecute
    ? {
        recipientName: resolved.name,
        recipientAddress: resolved.address,
        recipientKnown: resolved.known,
        recipientNameFromMessage: !resolved.known && resolved.nameFromLabel,
        amount,
        asset: merged.asset as 'USDC' | 'SUI',
        frequency,
        monthlyDay: frequency === 'MONTHLY' ? (merged.monthlyDay ?? 1) : null,
        note: merged.note,
      }
    : null;

  // --- Verdict -----------------------------------------------------------
  const verdict: SafetyVerdict = materialDisagreement
    ? 'DISPUTED'
    : flags.some((f) => f.severity === 'warn')
      ? 'WARN'
      : 'CLEAR';

  const status: IntentReview['status'] = !plan
    ? 'cannot_execute'
    : verdict === 'CLEAR'
      ? 'ready'
      : 'needs_review';

  return { status, verdict, plan, planHash: null, flags, demo };
}

type ResolvedRecipient = {
  name: string;
  address: string;
  known: boolean;
  nameFromLabel: boolean;
};

function resolveRecipient(
  reference: string | null,
  saved: SavedRecipient[],
  label: string | null,
): ResolvedRecipient | null {
  if (!reference) {
    return null;
  }
  const ref = reference.trim();

  const byName = saved.find((r) => r.name.toLowerCase() === ref.toLowerCase());
  if (byName) {
    return { name: byName.name, address: byName.address, known: true, nameFromLabel: false };
  }

  if (SUI_ADDRESS_RE.test(ref)) {
    const byAddress = saved.find((r) => r.address.toLowerCase() === ref.toLowerCase());
    if (byAddress) {
      return { name: byAddress.name, address: byAddress.address, known: true, nameFromLabel: false };
    }
    const cleanLabel = label?.trim();
    return cleanLabel
      ? { name: cleanLabel, address: ref, known: false, nameFromLabel: true }
      : { name: `${ref.slice(0, 6)}...${ref.slice(-4)}`, address: ref, known: false, nameFromLabel: false };
  }

  return null;
}

/** True only when both models committed to a value and the values differ. */
function conflict<T>(a: T | null | undefined, b: T | null | undefined): boolean {
  return a != null && b != null && a !== b;
}

function norm(value: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(0, 10);
}
