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
  /** True when the pipeline ran on canned fixtures instead of live Gonka calls. */
  demo: z.boolean(),
});
export type IntentReview = z.infer<typeof intentReviewSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
