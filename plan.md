# RemitGuard AI Full Development Plan

Build RemitGuard as a real Expo 54 client backed by a separate Node/TypeScript service. The client provides a calm, light-first fintech experience for one signed-in user; the server owns Gonka credentials, persistence, recurring scheduling, deterministic safety decisions, and Sui execution. Prove a real Sui testnet USDC transfer early, then layer the AI workflow and durable remittance features on top.

## Confirmed Decisions

- Client: existing Expo `~54.0.36`, Expo Router `~6.0.24`, React 19, React Native 0.81, strict TypeScript, NativeWind 5 preview, and typed routes.
- Backend: separate Node/TypeScript API with a worker/scheduler. Use Postgres with Prisma unless the contract-discovery spike finds a hosting constraint.
- Identity: Enoki zkLogin with Google, one active account per device, sign-out supported. Do not put Gonka secrets or private signing material in Expo.
- Chain: Sui testnet and existing testnet USDC only. Use Enoki sponsorship when its current Expo 54-compatible flow is confirmed; retain an unsponsored development fallback.
- Platforms: Android, iOS, and web. Treat web auth/wallet behavior as a separately verified adapter rather than assuming native parity.
- Navigation: Home, Send, Activity, Recipients. Home emphasizes balance and the next action.
- Visual system: calm and trustworthy; light-first; expressive editorial sans for interface text and monospace for addresses, request IDs, and transaction data. Use restrained neutral surfaces with emerald/teal success accents and amber safety warnings. No fear-based fraud claims.
- Safety UX: flagged or disputed transfers go to a review screen showing both model outcomes, rationales, recipient status, and request IDs. The user must deliberately choose Continue anyway; the system never silently blocks or auto-executes.
- Demo mode: an explicit feature flag selects deterministic fixtures when external services are unavailable, while keeping real integration paths intact.
- Recurring rules: monthly day 1-28 plus an IANA timezone. Scheduled work is backend-owned and reconciles by recipient plus time window, not exact amount.

## Step-by-Step Implementation

### Phase 0: Contract and Risk Spike

Track the active discovery work in [docs/phase-0-integration-decisions.md](docs/phase-0-integration-decisions.md).

1. Read the exact Expo 54 and current Enoki documentation before dependency or auth work, as required by [AGENTS.md](AGENTS.md).
2. Confirm Gonka Router base URL, authentication, OpenAI-compatible request format, model IDs, request-ID field, structured-output support, rate limits, and timeout policy. If credentials remain unavailable, define a mock adapter with the same normalized response type.
3. Confirm the current Sui testnet USDC coin type, RPC endpoint, explorer URL, Enoki sponsorship API, OAuth redirect requirements, and whether browser support is viable.
4. Write a short integration decision record covering signing authority, confirmation authorization, service failure behavior, and demo-mode boundaries.

### Phase 1: Repository Foundation

Initial foundation completed: shared contracts, server health/readiness endpoints, environment templates, Prisma schema scaffolding, and validation scripts are now present. External integration work remains gated by Phase 0 decisions.

5. Add a workspace structure for Expo client code, server API code, and shared domain contracts. Preserve the current root client while adding clearly isolated `server/` and `shared/` packages if a monorepo migration adds too much risk.
6. Add environment schemas and startup validation. Separate `EXPO_PUBLIC_*` values from server-only Gonka, database, Enoki, Sui, and scheduler secrets. Provide `.env.example` files without credentials.
7. Add backend HTTP conventions, request validation, typed errors, request correlation IDs, health/readiness endpoints, and consistent logging.
8. Add Prisma schema and migrations for users, linked auth identities, recipients, payment intents, safety checks, transactions, recurring rules, reconciliation prompts, and idempotency keys. Store audit timestamps and chain identifiers needed for support.
9. Add shared types for payment intent, parser/verifier output, safety verdict, recipient, recurring rule, transaction status, dashboard aggregates, and API errors.
10. Add Vitest or the selected TypeScript test runner, strict typecheck scripts, lint scripts for client and server, and a root development command that starts client, API, and worker independently.

### Phase 2: Authentication and Settlement Vertical Slice

Initial settlement foundation completed: Expo auth dependencies, native/web session storage, Sui testnet configuration, and read-only network/balance API endpoints are now present. zkLogin signing, Enoki sponsorship, and real transfers remain credential-gated.

Auth shell now runs in Expo Go: `AuthProvider` context, `Stack.Protected` route guards, an `(app)` authenticated group, a working sign-in screen, and persisted sessions (SecureStore native, sessionStorage web). `@mysten/dapp-kit` / `registerEnokiWallets` were removed from the native path because they are browser-only.

Transfer vertical slice (step 14) is live, client-side: Home shows real testnet balances (USDC + SUI) with pull-to-refresh and a testnet-SUI faucet button; `app/(app)/send.tsx` builds a PTB with `coinWithBalance`, signs with the session signer (`AuthClient.getSigner`), submits via `SuiJsonRpcClient`, waits for finality, and shows digest + Suiscan link. `lib/sui/` holds `sui-client.ts`, `coins.ts`, `transfer.ts`, `faucet.ts`. Backend confirmation-token flow, Enoki sponsorship (step 15), and persistence/reconcile are still to do.

Two `AuthClient` implementations sit behind `resolveAuthClient()` in `lib/auth/auth-context.tsx`:
- `lib/auth/demo-auth.ts`: generates a local Ed25519 keypair (`expo-crypto`) and derives a real Sui testnet address. No network, no Google. Used on native and whenever `EXPO_PUBLIC_DEMO_MODE=true`.
- `lib/auth/enoki-auth.web.ts`: real Enoki zkLogin via `EnokiFlow` + `expo-auth-session` + `expo-web-browser`. Web only, because Google's web OAuth client rejects non-http redirects and `EnokiFlow` needs `crypto.subtle`. Selected when `AUTH_MODE === 'enoki'` (web + credentials present + demo flag off). Native zkLogin needs a dev build (hosted redirect page + `crypto.subtle` polyfill) and is deferred.

11. Replace the bare provider setup in [app/_layout.tsx](app/_layout.tsx) with auth/session, query/data, safe-area, and theme providers. Add public onboarding/sign-in routes and an authenticated route group with a sign-out path.
12. Implement Google Enoki zkLogin initialization, callback handling, session persistence, expiry handling, and logout. Store only appropriate session material using platform-safe secure storage; define a web storage fallback with its limitations.
13. Implement server-side authenticated request verification and user-to-wallet resolution. Never trust a client-supplied user ID or wallet address without checking the authenticated session.
14. Build the smallest real payment vertical slice: show the user wallet address and testnet USDC balance, select a saved or fixture recipient, build a Sui programmable transaction block, authorize it, submit it, persist a pending transaction, and poll/reconcile final status.
15. Add the Enoki-sponsored flow after the unsponsored path is observable. The backend must require a user-confirmed intent and an idempotency key before execution.
16. Add transaction result UI with pending/success/failure states, explorer link, digest, amount, recipient, and gas/sponsorship status. Document the testnet funding procedure.
17. Verify this phase with one funded real testnet transfer on Android/iOS and web where supported. Do not proceed if the core authorization or chain-status path is unreliable.

### Phase 3: Product Shell and Visual System

18. Replace starter screens [app/index.tsx](app/index.tsx) and [app/chat.tsx](app/chat.tsx), and add typed bottom-tab routes for Home, Send, Activity, and Recipients plus modal/detail routes for review, transaction details, and recurring-plan editing.
19. Create RemitGuard-specific design tokens in [global.css](global.css) and shared components: typography, spacing, surfaces, buttons, inputs, status badges, amount rows, safety banners, empty/loading/error states, and accessible icon buttons.
20. Build Home around balance, next upcoming payment, primary Send action, safety status, recent activity, and a compact deterministic spending summary. Keep sections scannable and avoid dashboard card nesting.
21. Build Send as a conversational instruction composer with recipient suggestions, amount/currency context, one-time versus monthly choice, and clear progress states. The screen only orchestrates API calls; it does not parse or calculate.
22. Build Activity with transaction filters and detail navigation. Build Recipients with add/edit/delete, wallet-address validation, known-recipient status, and a clear first-time-recipient treatment.
23. Validate responsive layouts and platform-specific keyboard, safe-area, focus, screen-reader, and web-navigation behavior. Keep light theme polished before considering dark mode.

### Phase 4: Intent Parsing and Dual-AI Safety

24. Implement a server-side Gonka adapter with strict timeouts, bounded retries, structured-output normalization, model selection, and redacted logs. Do not leak prompts or secrets to the client.
25. Add parser and independent verifier calls using distinct configured models. Both return normalized intent fields: recipient reference, amount, asset, frequency, date, timezone, notes, confidence/uncertainty, rationale, and request ID.
26. Implement deterministic consensus and risk logic in a pure module. Compare material intent fields, resolve saved recipients deterministically, flag disagreement, urgency language, new recipients, unusually high amounts, missing fields, and unsupported requests.
27. Add the Send state machine: draft, parsing, verification, review, confirmation, submitting, pending, success, and recoverable error. Preserve an immutable confirmation snapshot so execution uses exactly what the user reviewed.
28. Build the review screen with plan summary, recipient address, recurrence, both model rationales, request IDs, deterministic flags, and explicit Confirm or Continue anyway actions. Require a fresh server-side confirmation token/idempotency key before execution.
29. Test parser/verifier normalization, model disagreement, malformed outputs, timeout/fallback behavior, warning override, duplicate submission, and the guarantee that an unconfirmed intent cannot execute. Use feature-flagged fixtures for a reliable demo path.

### Phase 5: Recipients, Recurring Payments, and Reconciliation

30. Connect the Recipients UI to authenticated CRUD endpoints and enforce ownership, address format, name uniqueness per user, and safe deletion behavior when history exists.
31. Add recurring-rule creation from a confirmed intent: recipient, amount, asset, monthly day 1-28, timezone, active/paused state, next trigger, and user-visible notes. Persist all schedule changes.
32. Implement a worker that claims due rules transactionally, computes the next occurrence in the rule timezone, and uses idempotency keys to prevent duplicate execution. Define retry/backoff and a visible failed state.
33. Before auto-sending, query the transaction log for a manual transfer to the same recipient in the configured reconciliation window since the prior trigger. If found, create a prompt rather than sending; support send anyway, skip this month, or adjust. Skip advances to the next month with no catch-up.
34. Add timezone and calendar tests for days 1-28, daylight-saving transitions, missed runs, retries, paused rules, duplicate worker claims, and manual-transfer matching independent of amount.
35. Add UI for upcoming payments, recurring-plan status, duplicate-payment prompts, and send/skip/adjust actions. Explain that schedules run from the RemitGuard service, not automatically on Sui.

### Phase 6: Dashboard, Operations, and Demo Readiness

36. Implement deterministic transaction aggregation for this month/history, totals by recipient, recurring versus one-off split, and upcoming payments. Optional Gonka conversational analytics may explain these results but may not compute them.
37. Add API pagination, loading/offline/error states, retry controls, stale transaction reconciliation, and safe empty states. Add rate limiting and authorization checks around all user-facing endpoints.
38. Deploy a minimal staging API, database, and worker with secret management, migration execution, structured logs, health checks, and a staging client configuration. Keep demo fixtures switchable without disguising real transfer state.
39. Add an end-to-end rehearsal script: Google sign-in, funded wallet, parent/student remittance story, urgent/new-recipient warning, explicit approval, sponsored testnet settlement, explorer link, recurring rule, duplicate-payment prompt, and updated dashboard.
40. Prepare concise in-app wording and pitch documentation that says the safety layer is heuristic, recurring transfers are backend-scheduled, USDC is an existing testnet asset, and fiat off-ramp is out of scope.

## Relevant Files

- [AGENTS.md](AGENTS.md): governing Expo 54, product scope, Sui/Gonka architecture, and explicit exclusions.
- [package.json](package.json): client dependencies and scripts.
- [app/_layout.tsx](app/_layout.tsx): provider composition, auth routing, and navigation.
- [app/index.tsx](app/index.tsx): Home dashboard replacement.
- [app/chat.tsx](app/chat.tsx): Send workflow replacement.
- [global.css](global.css): light-first tokens and NativeWind-compatible visual foundation.
- `server/`: API, Gonka adapter, auth verification, Sui/Enoki execution, persistence, scheduler, and tests.
- `shared/`: domain contracts and validation schemas shared by client and server.
- `prisma/schema.prisma` and `prisma/migrations/`: durable data model and migration history.
- [docs/phase-0-integration-decisions.md](docs/phase-0-integration-decisions.md): verified platform constraints and open integration decisions.
- [README.md](README.md): setup, environment variables, testnet funding, deployment, demo mode, and known limitations.

## Verification Checklist

1. Run the existing `npm run lint`, then maintain client/server strict typecheck and test scripts on every phase.
2. Unit-test pure consensus/risk logic, recipient resolution, amount/intent validation, monthly date calculation, timezone behavior, reconciliation matching, skip semantics, idempotency, and spending aggregation.
3. API-test auth ownership, Gonka response normalization, request IDs, confirmation-token enforcement, error mapping, and mocked Sui/Enoki failures.
4. Run a real funded Sui testnet transfer and verify digest, explorer URL, final status, asset amount, and sponsored gas behavior.
5. Manually verify native and web sign-in, tab navigation, keyboard/safe-area behavior, loading/error states, disputed-review override, recipient CRUD, recurring prompt choices, and dashboard totals.
6. Run the complete demo rehearsal twice: once with real services and once with demo mode, confirming the UI clearly distinguishes fixture state from chain-settled state.

## Explicit Exclusions

- No custom stablecoin, token minting, fiat off-ramp, lending, or microloans.
- No claim of guaranteed scam detection or automatic fraud prevention.
- No native on-chain cron or implication that Sui schedules payments.
- No AI-generated deterministic financial totals, silent averaging of model disagreement, or execution without explicit human confirmation.

## Open Items for Phase 0

- Exact Gonka Router contract and available model pair.
- Current Enoki sponsorship and web compatibility details.
- Final Node framework/hosting choice and Postgres provider.
- Reconciliation-window length and default high-amount threshold, which should be product-configured rather than hidden in UI code.
