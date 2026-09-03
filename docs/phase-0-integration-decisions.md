# Phase 0: Integration Decisions

**Status:** Discovery recorded; external integration decisions remain open  
**Started:** 2026-09-03

This document records the verified constraints and unresolved integration questions for RemitGuard AI before implementation begins.

## Current Repository Baseline

- Expo SDK `~54.0.36`
- Expo Router `~6.0.24`
- React `19.1.0`
- React Native `0.81.5`
- React Native Web `~0.21.0`
- TypeScript `~5.9.2`
- NativeWind `^5.0.0-preview.4`
- Typed routes and React Compiler enabled
- Existing app scheme: `muba2026`
- Web output: static
- Existing auth dependencies: none
- Existing Sui, Enoki, Gonka, database, scheduler, validation, and test dependencies: none

## Verified Expo 54 Constraints

Expo SDK 54 targets React Native 0.81, React 19.1, React Native Web 0.21, and requires Node.js 20.19.x or newer. The project versions match those targets.

The project already defines the `muba2026` scheme in `app.json`. This is necessary for native authentication redirects, but the final redirect URI must still be registered with the identity provider for each platform.

Expo AuthSession supports Android, iOS, and web. Its documented authorization-code flow uses PKCE by default, and the recommended code challenge method is `S256`. Client secrets must not be stored in the Expo application.

Expo web authentication requires a secure origin such as `localhost` or HTTPS. The redirect must return to the same web origin that started the authentication flow. Production web will need a fixed, allowlisted HTTPS redirect URL.

Expo Router handles deep links automatically. Authentication redirects should therefore be integrated with the router rather than adding a competing global link handler.

## Verified Enoki Direction

The current Enoki documentation describes:

- Web 2.0 authentication, including Google, connected to Sui addresses through zkLogin.
- Self-custodial addresses generated with zkLogin proofs.
- Sponsored transactions managed through the Enoki Developer Portal.
- A TypeScript SDK for frontend transaction flows.
- An HTTP API suitable for backend integration.

The final implementation must select one concrete Enoki flow after checking the current SDK/API reference and Expo compatibility. The backend remains responsible for server-only API keys and must not expose them to the client.

zkLogin is a Sui protocol-level primitive, not an Enoki-only wallet feature. The application creates a short-lived ephemeral key and nonce, obtains an OAuth JWT, obtains a salt and zero-knowledge proof, derives the Sui address, and submits transactions with the ephemeral signature plus proof. Enoki provides managed wallet registration, OAuth integration, salt/proof infrastructure, and sponsored-transaction APIs that reduce the amount of this flow the application must operate directly.

The Enoki quickstart URLs previously anticipated in the development plan returned 404 during discovery. Do not implement from those URLs. Use the current Enoki TypeScript SDK, HTTP API, and Developer Portal documentation when credentials and project access are available.

The current Enoki TypeScript SDK documents `@mysten/enoki`, wallet-standard registration through `registerEnokiWallets`, and integration with `@mysten/dapp-kit`. The current sponsored-transaction documentation requires a backend with a private Enoki API key; it sponsors transaction-kind bytes, then the user signs the returned bytes before the backend submits the completed transaction.

**Decision (2026-09-03):** `@mysten/dapp-kit` and `registerEnokiWallets` are browser-only (wallet-standard, DOM, web React Query context) and do not run in React Native / Expo Go. They were removed from the native path. The native/Expo Go zkLogin flow will instead use `expo-auth-session` for the Google `id_token` plus the Enoki HTTP API for salt and ZK proof, matching the protocol-level flow described above. `@mysten/dapp-kit` may still be used for the web adapter only. Until Enoki credentials are provisioned, the app runs an explicit demo auth client (`lib/auth/demo-auth.ts`) that generates a local ephemeral Ed25519 keypair via `expo-crypto` and derives a real Sui testnet address. All auth clients implement the same `AuthClient` interface so screens do not branch on demo vs. real.

## Sui Decisions to Confirm

- [ ] Confirm the current Sui testnet RPC endpoint.
- [ ] Confirm the current existing testnet USDC package, module, and type identifier.
- [ ] Confirm the explorer URL format for transaction digests.
- [ ] Confirm whether the selected Enoki sponsorship flow supports the chosen transaction authorization model.
- [ ] Confirm testnet faucet/funding steps and recipient demo addresses.
- [ ] Confirm how the backend receives or coordinates the user's authorization without custody of user signing secrets.

No custom stablecoin will be created. The first real transfer will use existing testnet USDC only.

## Gonka Contract to Confirm

Gonka access is not configured yet. Before adding a client or server SDK, confirm:

- [ ] Base URL and authentication mechanism.
- [ ] OpenAI-compatible request and response format.
- [ ] Available model IDs and two distinct models for parser/verifier calls.
- [ ] Structured-output or JSON-schema support.
- [ ] Request-ID response field and retention requirements.
- [ ] Rate limits and maximum prompt/response sizes.
- [ ] Timeout, retry, and service-unavailable behavior.
- [ ] Data retention and whether prompts may be persisted.

Until these are confirmed, the server should use an adapter interface and a deterministic fixture implementation rather than hard-coding an assumed Gonka contract.

## Proposed Authorization Boundary

1. The client sends natural-language text to the authenticated backend.
2. The backend calls the parser and verifier models.
3. Deterministic backend code resolves recipients and calculates the safety verdict.
4. The client displays the immutable plan and safety review.
5. The user explicitly confirms the exact reviewed plan.
6. The backend issues or validates a short-lived confirmation token and idempotency key.
7. Only then does the Sui execution service construct and submit the transaction.
8. The backend persists the transaction digest and reconciles final chain status.

An AI response alone must never authorize execution. The client must never contain Gonka secrets, database credentials, or backend signing keys.

## Demo and Failure Policy

- `DEMO_MODE` will be an explicit environment flag, not an invisible fallback.
- Demo fixtures must visibly identify fixture state and must never be presented as settled blockchain transactions.
- Gonka unavailability should result in a recoverable UI state or explicit demo-mode behavior.
- Sui submission failures must remain visible and must not create a successful transaction record.
- Duplicate execution attempts must be rejected through server-side idempotency.
- The safety layer is heuristic and may warn without blocking a user-confirmed transfer.

## Phase 0 Exit Criteria

Phase 0 is complete when:

- [ ] Gonka request/response contract is recorded.
- [ ] Two Gonka model IDs are available or a fixture contract is approved.
- [ ] Enoki project, OAuth provider, redirect URLs, and sponsorship flow are confirmed.
- [ ] Sui testnet USDC type and explorer URL are recorded.
- [ ] Signing and authorization responsibilities are written down.
- [ ] Postgres provider and Node runtime/hosting are selected.
- [ ] Reconciliation window and high-amount warning threshold are product-configured.
- [ ] A funded testnet wallet and recipient address are available for the settlement spike.

## Sources Consulted

- Expo SDK 54 reference: https://docs.expo.dev/versions/v54.0.0/
- Expo AuthSession SDK 54 reference: https://docs.expo.dev/versions/v54.0.0/sdk/auth-session/
- Expo WebBrowser SDK 54 reference: https://docs.expo.dev/versions/v54.0.0/sdk/webbrowser/
- Enoki documentation: https://docs.enoki.mystenlabs.com/
- Sui documentation entry point: https://docs.sui.io/
