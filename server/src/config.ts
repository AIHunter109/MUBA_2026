import { z } from 'zod';

const optionalUrl = z.string().url().optional().or(z.literal(''));

/** Env booleans arrive as strings; "false"/"0"/"" are false, everything else truthy is true. */
const envBool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null || v === '' ? fallback : !/^(false|0|no|off)$/i.test(v.trim())));

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DEMO_MODE: envBool(true),
  SUI_NETWORK: z.enum(['testnet', 'devnet']).default('testnet'),
  SUI_RPC_URL: optionalUrl,
  SUI_USDC_TYPE: z.string().optional(),
  ENOKI_API_KEY: z.string().optional(),
  ENOKI_PROJECT_ID: z.string().optional(),
  GONKA_BASE_URL: z.string().url().default('https://api.gonkarouter.io'),
  GONKA_API_KEY: z.string().optional(),
  GONKA_PARSER_MODEL: z.string().default('deepseek-ai/DeepSeek-V4-Flash-0731'),
  GONKA_VERIFIER_MODEL: z.string().default('MiniMaxAI/MiniMax-M2.7'),
  GONKA_TIEBREAKER_MODEL: z.string().default('moonshotai/Kimi-K2.6'),
  GONKA_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  CONFIRMATION_TOKEN_SECRET: z.string().min(1).default('dev-only-change-me'),
  CONFIRMATION_TOKEN_TTL_MS: z.coerce.number().int().positive().default(10 * 60_000),
  RECONCILIATION_WINDOW_DAYS: z.coerce.number().int().positive().default(14),
  HIGH_AMOUNT_THRESHOLD_USDC: z.coerce.number().positive().default(500),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid server environment: ${issues}`);
  }

  return result.data;
}
