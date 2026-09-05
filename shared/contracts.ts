import { z } from 'zod';

export const paymentAssetSchema = z.enum(['USDC']);
export type PaymentAsset = z.infer<typeof paymentAssetSchema>;

export const paymentFrequencySchema = z.enum(['ONE_TIME', 'MONTHLY']);
export type PaymentFrequency = z.infer<typeof paymentFrequencySchema>;

export const paymentIntentSchema = z.object({
  recipientName: z.string().min(1),
  recipientAddress: z.string().min(1),
  amount: z.number().positive(),
  asset: paymentAssetSchema,
  frequency: paymentFrequencySchema,
  monthlyDay: z.number().int().min(1).max(28).optional(),
  timezone: z.string().min(1).optional(),
  note: z.string().max(500).optional(),
});
export type PaymentIntent = z.infer<typeof paymentIntentSchema>;

export const transactionStatusSchema = z.enum([
  'PENDING',
  'SUCCEEDED',
  'FAILED',
]);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

export const safetyVerdictSchema = z.enum(['CLEAR', 'WARN', 'DISPUTED']);
export type SafetyVerdict = z.infer<typeof safetyVerdictSchema>;

export const transferAssetSchema = z.enum(['USDC', 'SUI']);
export type TransferAsset = z.infer<typeof transferAssetSchema>;

/**
 * One model's normalized read of the user's instruction. This is DATA, never an
 * instruction to execute anything. Every money-critical field is re-derived by
 * deterministic code before it reaches the user.
 */
export const parsedIntentSchema = z.object({
  recipientReference: z.string().nullable(),
  /** A name the message assigns to a new recipient ("his name is John"), else null. */
  recipientLabel: z.string().max(40).nullable(),
  amount: z.number().positive().nullable(),
  asset: transferAssetSchema.nullable(),
  frequency: z.enum(['ONE_TIME', 'MONTHLY']).nullable(),
  monthlyDay: z.number().int().min(1).max(28).nullable(),
  note: z.string().max(500).nullable(),
  /** Model's read: does the message use pressure / urgency phrasing. */
  urgencyLanguage: z.boolean(),
  /** Model's read: the narrative matches a known scam / social-engineering script. */
  scamPatternFlag: z.boolean(),
  /** Factual claims in the message that a human would need to verify (not verified here). */
  claimsToVerify: z.array(z.string()).max(10),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(600),
});
export type ParsedIntent = z.infer<typeof parsedIntentSchema>;

export const modelReadSchema = z.object({
  role: z.enum(['parser', 'verifier', 'tiebreaker']),
  model: z.string(),
  requestId: z.string().nullable(),
  latencyMs: z.number(),
  ok: z.boolean(),
  error: z.string().nullable(),
  intent: parsedIntentSchema.nullable(),
});
export type ModelRead = z.infer<typeof modelReadSchema>;

export const safetyFlagSchema = z.object({
  code: z.enum([
    'MODEL_DISAGREEMENT',
    'RECIPIENT_UNRESOLVED',
    'FIRST_TIME_RECIPIENT',
    'HIGH_AMOUNT',
    'URGENCY_LANGUAGE',
    'SCAM_PATTERN',
    'UNVERIFIED_CLAIMS',
    'MISSING_FIELDS',
    'UNSUPPORTED_REQUEST',
  ]),
  severity: z.enum(['info', 'warn']),
  detail: z.string(),
});
export type SafetyFlag = z.infer<typeof safetyFlagSchema>;

/** The deterministic, ready-to-ratify plan. Execution uses exactly this. */
export const resolvedPlanSchema = z.object({
  recipientName: z.string(),
  recipientAddress: z.string(),
  recipientKnown: z.boolean(),
  /** True when recipientName came from the instruction for a new recipient, so the client offers to save it by default. */
  recipientNameFromMessage: z.boolean().default(false),
  amount: z.number().positive(),
  asset: transferAssetSchema,
  frequency: z.enum(['ONE_TIME', 'MONTHLY']),
  monthlyDay: z.number().int().min(1).max(28).nullable(),
  note: z.string().max(500).nullable(),
});
export type ResolvedPlan = z.infer<typeof resolvedPlanSchema>;

export const intentReviewSchema = z.object({
  /** ready = CLEAR, needs_review = WARN/DISPUTED, cannot_execute = no valid plan. */
  status: z.enum(['ready', 'needs_review', 'cannot_execute']),
  verdict: safetyVerdictSchema,
  plan: resolvedPlanSchema.nullable(),
  planHash: z.string().nullable(),
  flags: z.array(safetyFlagSchema),
  modelReads: z.array(modelReadSchema),
  /** Real-world claims either model spotted in the message (e.g. "hurricane in the Philippines") - not verified yet, offered to the user as optional fact-checks. */
  claims: z.array(z.string()).default([]),
  /** True when the pipeline ran on canned fixtures instead of live Gonka calls. */
  demo: z.boolean(),
});
export type IntentReview = z.infer<typeof intentReviewSchema>;

/**
 * The AI Fact Checker layer: a claim mentioned in a payment message, checked
 * against real retrieved news evidence (never a model's own memory) by two
 * independent Gonka models. See server/src/factcheck for the full pipeline.
 */
export const claimVerdictSchema = z.enum([
  'UNVERIFIABLE', // no real evidence could be retrieved - deterministic hard override, ignores model output
  'SUPPORTED', // evidence found and both models read it as corroborating the claim
  'CONTRADICTED', // evidence found and both models read it as refuting the claim
  'DISPUTED', // evidence found but the two models disagreed on what it shows
]);
export type ClaimVerdict = z.infer<typeof claimVerdictSchema>;

export const claimEvidenceSchema = z.object({
  title: z.string(),
  source: z.string(),
  url: z.string(),
  publishedAt: z.string().nullable(),
  snippet: z.string(),
});
export type ClaimEvidence = z.infer<typeof claimEvidenceSchema>;

export const claimStanceSchema = z.enum(['supports', 'contradicts', 'unclear']);
export type ClaimStance = z.infer<typeof claimStanceSchema>;

export const claimModelReadSchema = z.object({
  role: z.enum(['parser', 'verifier']),
  model: z.string(),
  requestId: z.string().nullable(),
  latencyMs: z.number(),
  ok: z.boolean(),
  error: z.string().nullable(),
  stance: claimStanceSchema.nullable(),
  rationale: z.string().nullable(),
  citedEvidenceIndex: z.number().int().nullable(),
});
export type ClaimModelRead = z.infer<typeof claimModelReadSchema>;

export const claimCheckResultSchema = z.object({
  claim: z.string(),
  verdict: claimVerdictSchema,
  /** A 0-100 restatement of the verdict, in the language the Gonka brief asks for. Not an independent computation - derived 1:1 from `verdict`. */
  truthScore: z.number().min(0).max(100),
  evidence: z.array(claimEvidenceSchema),
  modelReads: z.array(claimModelReadSchema),
  onChain: z
    .object({
      network: z.literal('sui-testnet'),
      packageId: z.string(),
      txDigest: z.string(),
      explorerUrl: z.string(),
    })
    .nullable(),
});
export type ClaimCheckResult = z.infer<typeof claimCheckResultSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
