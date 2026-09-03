import { z } from 'zod';

const optionalUrl = z.string().url().optional().or(z.literal(''));

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DEMO_MODE: z.coerce.boolean().default(true),
  SUI_NETWORK: z.enum(['testnet', 'devnet']).default('testnet'),
  SUI_RPC_URL: optionalUrl,
  SUI_USDC_TYPE: z.string().optional(),
  ENOKI_API_KEY: z.string().optional(),
  ENOKI_PROJECT_ID: z.string().optional(),
  GONKA_BASE_URL: optionalUrl,
  GONKA_API_KEY: z.string().optional(),
  GONKA_PARSER_MODEL: z.string().optional(),
  GONKA_VERIFIER_MODEL: z.string().optional(),
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
