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

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
