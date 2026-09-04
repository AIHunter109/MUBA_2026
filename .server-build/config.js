"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnvironment = loadEnvironment;
const zod_1 = require("zod");
const optionalUrl = zod_1.z.string().url().optional().or(zod_1.z.literal(''));
const environmentSchema = zod_1.z.object({
    // The read-only Sui API can run without the database during the demo. Database-backed
    // recipients, schedules, and audit records will opt in by providing this value.
    DATABASE_URL: zod_1.z.string().min(1).optional(),
    SERVER_PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(3000),
    DEMO_MODE: zod_1.z.coerce.boolean().default(true),
    SUI_NETWORK: zod_1.z.enum(['testnet', 'devnet']).default('testnet'),
    SUI_RPC_URL: optionalUrl,
    SUI_USDC_TYPE: zod_1.z.string().optional(),
    ENOKI_API_KEY: zod_1.z.string().optional(),
    ENOKI_PROJECT_ID: zod_1.z.string().optional(),
    GONKA_BASE_URL: optionalUrl,
    GONKA_API_KEY: zod_1.z.string().optional(),
    GONKA_PARSER_MODEL: zod_1.z.string().optional(),
    GONKA_VERIFIER_MODEL: zod_1.z.string().optional(),
    RECONCILIATION_WINDOW_DAYS: zod_1.z.coerce.number().int().positive().default(14),
    HIGH_AMOUNT_THRESHOLD_USDC: zod_1.z.coerce.number().positive().default(500),
});
function loadEnvironment(source = process.env) {
    const result = environmentSchema.safeParse(source);
    if (!result.success) {
        const issues = result.error.issues
            .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
            .join('; ');
        throw new Error(`Invalid server environment: ${issues}`);
    }
    return result.data;
}
