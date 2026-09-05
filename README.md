# RemitGuard AI

**Manage cross-border family remittances as easily as sending a message - with an AI safety layer that flags likely scams before money moves, and stablecoin settlement on Sui.**

| Submission | Track |
| --- | --- |
| **Sui** | Track 1: Payments & Stablecoins *(also qualifies for Track 2: AI x SUI - see [Track Fit](#3-track-fit))* |
| **GonkaRouter** | AI Tools with Genuine Public Value - *AI Fact Checker* direction |

Runs on **iOS, Android, and the web** from one codebase (Expo + Expo Router). All three are shipping targets.

---

## 1. Problem Statement

Foreign workers and international students in Malaysia routinely send part of their earnings home, or receive support money from family abroad: *"every month I need to send Mum 150 USDC"*, *"this month send an extra 30 for school fees"*. This recurring task is harder than it should be:

- **It is expensive and slow.** The global average remittance cost is around 6.4% of the amount sent; banks specifically average closer to 15%. Cross-border rails are also slow to settle.
- **It is easy to lose track of.** Repeated transfers to several recipients, changing amounts, and one-off payments (fees, emergencies) pile up with no single view.
- **It is a prime target for scams.** "Urgent family emergency, send money now" social engineering preys specifically on people who send money to relatives. A person mid-transfer is exactly the wrong moment to be unprotected.

Existing apps solve the *sending* but not the *judgement* - nothing sits between "I got a worrying message" and "the money is gone".

## 2. What We Built

RemitGuard AI lets a user drive transfers with plain-language instructions. An AI layer parses the instruction, a **dual-model safety layer** cross-checks it for scam-risk patterns and fact-checks any real-world claims against live news, the user confirms, and **Sui executes the transfer as a USDC payment**.

**Core principle, enforced throughout the codebase:** *AI reasons, rules calculate, chain executes.* A model never performs money math and never signs or submits a transaction. It parses, explains, and flags. Deterministic code decides. Sui executes only after an explicit human confirmation bound to the exact transaction bytes.

### Feature summary

| Area | What it does |
| --- | --- |
| **Natural-language transfers** | Type *"Send Mum 100 USDC for groceries"*. Two Gonka models independently extract `{recipient, amount, asset, frequency, notes}`; deterministic code resolves the recipient and builds the plan. |
| **Dual-AI safety layer** | Parser model plus a different verifier model re-read the same message. Disagreement, urgency language, first-time recipient, and unusually high amounts combine (deterministically) into a `CLEAR` / `WARN` / `DISPUTED` verdict. Never auto-blocks - always lets the user proceed after a warning. |
| **AI Fact Checker** | Any factual claim in the message (or pasted directly into the standalone checker) is verified against **real retrieved news evidence** by two Gonka models, producing a Truth Score, a reasoning trace, and the **Gonka Request ID for every inference call**. Verdicts are optionally recorded on-chain. |
| **Confirmation & execution** | The backend builds a Programmable Transaction Block, mints a single-use confirmation token bound to a hash of the exact bytes, the user signs locally (zkLogin), and the server verifies the token against the bytes before submitting. |
| **Recipient book** | Simple name-to-Sui-address map so *"Mum"* resolves without raw addresses. A transfer to an address not in the book is treated as first-time and flagged. |
| **Recurring transfers + reconciliation** | Off-chain scheduler re-triggers recurring rules. On the due date it checks the log for a recent manual transfer to the same recipient - if found, it asks instead of auto-sending (deterministic, recipient + time-window match, not AI-guessed). |
| **Spending & upcoming views** | Deterministic aggregation of the transaction log (totals by recipient, recurring vs one-off, this month vs history) and a query over the recurring-rules table. |
| **Received-money detection** | Because Sui has no "sent to this address" query, incoming transfers are reconstructed from the coin objects the wallet currently owns and **persisted** the first time they are seen, so they survive that coin later being spent. Covers transfers sent from *any* wallet, not only from RemitGuard. |
| **Guardians & payment policies** | Optional: a trusted wallet can be required to approve payments above a threshold, to a first-time recipient, or when a saved recipient's wallet changes. |
| **Budget planner** | Plan family support against real monthly income/expenses/savings before committing to a recurring rule; affordability math is local and deterministic, with an optional natural-language assistant to fill the form. |

### Scope boundaries (stated up front)

- **No custom stablecoin.** Uses existing Sui testnet USDC. No claim of a new MYR-pegged token.
- **No fiat off-ramp.** Converting stablecoins to spendable local currency is the final mile, handled by existing licensed exchanges - explicitly out of scope.
- **No lending / microloan features.**
- **Recurring transfers are backend-scheduled, not on-chain automation.** Sui does not run the schedule.
- **The safety layer is heuristic pattern-flagging, not guaranteed fraud detection.** It is described as an "AI safety check" and never overclaims accuracy.

---

## 3. Track Fit

### Sui - Track 1: Payments & Stablecoins (primary)

The track asks for products that *"simplify sending, receiving, managing, or automating money with stablecoins"* and lists **remittance** explicitly. RemitGuard does all four:

- **Sending** - natural-language instruction to reviewed plan to PTB.
- **Receiving** - on-chain incoming-transfer detection, from any wallet.
- **Managing** - recipient book, transaction history, spending breakdown, budget planner.
- **Automating** - recurring rules with duplicate-payment reconciliation.

Helpful Sui features used: **zkLogin** (Google sign-in to Sui address, no seed phrase), **Programmable Transaction Blocks**, **sponsored transactions** (gas station), plus an on-chain event registry for fact-check verdicts.

### Sui - Track 2: AI x SUI (also qualifies)

*"Sui is integral, not an add-on."* RemitGuard's reason for using a blockchain at all is that **an AI agent can act as a first-class transaction actor** - no bank API lets third-party software (let alone an AI agent) construct and submit a payment on a user's behalf without a licensed fintech partnership. On Sui, that is a PTB the backend builds directly. The NL-instruction to dual-model-safety-check to PTB pipeline is a transaction-execution assistant in the track's own words. If the competition permits one project across multiple tracks, RemitGuard is submitted to both.

### GonkaRouter - AI Fact Checker direction

The GonkaRouter "preferred" spec asks for: input URL/text, multi-model cross-verification, a Truth Score (0-100), a reasoning trace, and displayed Gonka Request IDs. RemitGuard's fact-checker delivers all of these (see [section 5](#5-the-ai-fact-checker)), and adds the "On-Chain Proof" best practice by recording each verdict as a Sui event. All AI reasoning and verification runs through Gonka Router - there is no other LLM provider in the codebase.

---

## 4. GonkaRouter LLM Architecture

### 4.1 Transport

Every model call goes through **Gonka Router** (`https://api.gonkarouter.io`) using its **Anthropic Messages API-compatible** endpoint (`POST /v1/messages`, `x-api-key`, `anthropic-version: 2023-06-01`). One thin client - [`server/src/gonka/client.ts`](server/src/gonka/client.ts) - is the only place the app talks to an LLM. It:

- never logs prompt or completion text, and never logs the API key;
- returns, alongside the model text, the **provenance** of the call: `x-request-id` (the **Gonka Request ID**), latency, token usage, stop reason, and any `x-gonka-fallback` header;
- retries once on `408/429/5xx` with backoff, and times out (default 45s).

The `model` parameter is all that changes between roles, so models are swappable via env vars:

| Role | Default model | Purpose |
| --- | --- | --- |
| **Parser** | `deepseek-ai/DeepSeek-V4-Flash-0731` | First read of the instruction / evidence |
| **Verifier** | `MiniMaxAI/MiniMax-M2.7` | Independent second read - a *different* model for genuine cross-verification |
| **Tiebreaker** | `moonshotai/Kimi-K2.6` | Reserved for a third call when the two disagree hard |

### 4.2 Two pipelines, one shape

Both the **payment safety layer** and the **fact-checker** follow the same structure:

```
  user input
     |
     v
  [ RETRIEVE ]   deterministic - DB lookup (safety) or NewsAPI (fact-check)
     |
     +---------------------------+---------------------------+
     v                                                       v
  [ Parser model ]        (parallel: same input,     [ Verifier model ]
  via Gonka Router          a different model)         via Gonka Router
  -> structured JSON                                   -> structured JSON
  + Gonka Request ID                                   + Gonka Request ID
     |                                                       |
     +---------------------------+---------------------------+
     v
  [ COMBINE ]   deterministic code, NO LLM call
                disagreement is surfaced, never averaged
     |
     v
  verdict  +  reasoning trace  +  Gonka Request IDs
```

**Prompting for neutrality and structure.** Every system prompt (see [`server/src/safety/parse-intent.ts`](server/src/safety/parse-intent.ts) and [`server/src/factcheck/assess-claim.ts`](server/src/factcheck/assess-claim.ts)) instructs the model to:

- output **only a single minified JSON object** - no prose, no markdown, no `<think>`;
- **not invent** a recipient / amount / asset that is not in the message (use `null`);
- for fact-checking: **base the answer only on the supplied articles**, say `"unclear"` rather than guess, and cite the specific article the stance rests on.

Model output is then run through a Zod schema; anything that does not match is treated as a failed read (`ok: false`), not silently coerced.

**Consensus is deterministic.** [`server/src/safety/consensus.ts`](server/src/safety/consensus.ts) and [`server/src/factcheck/verdict.ts`](server/src/factcheck/verdict.ts) are the only places a verdict is decided, and **no LLM call happens there.** A genuine conflict (both models committed to *different* values) raises `DISPUTED` and is surfaced to the user - the system never averages two disagreeing reads into a false consensus. One model leaving a field `null` is "no opinion", not disagreement.

### 4.3 Transparency

Every model read carries its **Gonka Request ID** end to end - from the `x-request-id` response header, through the API contract, into the UI. The fact-check report and the payment reasoning trace both display the Request ID for each inference call, so a judge (or a user) can confirm the reasoning ran on Gonka's network and was not fabricated by our server.

---

## 5. The AI Fact Checker

Location: [`server/src/factcheck/`](server/src/factcheck/) - Endpoint: `POST /v1/intent/check-claim` - UI: the shield icon in the Send composer, and inline during a payment safety check.

### 5.1 Why not just ask the model?

Because it does not work. In testing, the same model gave a **confident, wrong** answer about a live event on a second try with no live data behind it. So the fact-checker **never uses a model's own memory as a source of truth.** The only source of "what is actually true" is real, independently-published news retrieved a moment before the check.

### 5.2 Pipeline

1. **Retrieve evidence - NewsAPI.**
   [`server/src/factcheck/newsapi.ts`](server/src/factcheck/newsapi.ts) queries `https://newsapi.org/v2/everything` with the claim text (`language=en`, `sortBy=publishedAt`, `pageSize=5`) and normalizes up to 5 articles into `{title, source, url, publishedAt, snippet}`.
   **Zero results is a hard stop:** the verdict is `UNVERIFIABLE`, full stop, and **no model is even consulted** - a model has no basis for an opinion with no evidence in front of it.

2. **Two independent model reads - Gonka Router.**
   [`server/src/factcheck/assess-claim.ts`](server/src/factcheck/assess-claim.ts) sends the claim **and the numbered article list** to the parser model and the verifier model in parallel. Each returns `{stance: supports | contradicts | unclear, citedEvidenceIndex, rationale}` and its Gonka Request ID. The prompt forbids using any knowledge not in the articles.

3. **Deterministic verdict - no LLM.**
   [`server/src/factcheck/verdict.ts`](server/src/factcheck/verdict.ts):

   | Condition | Verdict | Truth Score |
   | --- | --- | --- |
   | No evidence retrieved | `UNVERIFIABLE` | 50 |
   | Evidence found, both models `supports` | `SUPPORTED` | 85 |
   | Evidence found, both models `contradicts` | `CONTRADICTED` | 15 |
   | Evidence found, models disagree | `DISPUTED` | 50 |
   | Evidence found, models `unclear` / both calls failed | `UNVERIFIABLE` | 50 |

   The Truth Score is a fixed restatement of the verdict for the brief's 0-100 framing - it is **not** an independent confidence signal, and the code says so.

4. **On-chain record - Sui event (optional).**
   [`server/src/factcheck/on-chain.ts`](server/src/factcheck/on-chain.ts) calls `fact_check::record_claim_check` in the [`move/fact_check`](move/fact_check/sources/fact_check.move) package, signed by a **dedicated backend service keypair** (never a user key - this is a record of the platform's verification work). It emits:

   ```move
   public struct ClaimChecked has copy, drop {
       claim_hash: vector<u8>,   // sha256 of the claim text - never the text itself
       verdict: u8,              // 0 UNVERIFIABLE / 1 SUPPORTED / 2 CONTRADICTED / 3 DISPUTED
       evidence_count: u64,
       checked_by: address,
   }
   ```

   Only the **hash** goes on chain, so the ledger never becomes a public database of what people wrote in private messages - but anyone holding the original claim can verify the hash matches. The response includes the transaction digest and a SuiScan explorer link. If the package or signer key is not configured, the check still returns its full result with `onChain: null` - the on-chain layer is a transparency add-on, never a blocker.

### 5.3 What the user sees

A report card with: the verdict badge, the prominent Truth Score, every retrieved article (clickable, with source and date), each model's full rationale and stance, the **Gonka Request ID for each model call** (monospace, selectable), the on-chain explorer link when present, and a standing "this is an AI safety check, not a guarantee" disclaimer.

---

## 6. Sui Integration

| Component | Use |
| --- | --- |
| `@mysten/sui/transactions` | `Transaction` / PTB builder - split coin, transfer, build unsigned bytes for the client to sign. |
| `@mysten/sui/grpc` (`SuiGrpcClient`) | Balances, owned-object reads (received-transfer detection), transaction lookups, submitting signed transactions. The public JSON-RPC transport is deprecated; the app is on gRPC. |
| **zkLogin** via **Enoki** | Google OAuth to Sui address, no seed phrase. Real zkLogin runs on **web and native** (native uses Enoki's low-level client plus the SDK's `ZkLoginSigner` with `react-native-nitro-google-signin` for nonce support). A local Ed25519 demo wallet is the fallback when Enoki is not configured. |
| **Sponsored transactions** | Gas station integration so the user pays no gas. |
| `move/fact_check` Move package | On-chain `ClaimChecked` event registry for fact-check verdicts. |
| Confirmation tokens | HMAC-signed, TTL-bound, single-use tokens tied to a hash of the exact transaction bytes. `/v1/intent/execute` refuses any request without a valid one - a model response alone can never move money. |

**The money-movement flow:**

```
NL instruction
   -> POST /v1/intent/parse
   -> dual-model reads + deterministic review
   -> user sees the plan and the safety verdict
   -> user taps "Confirm & Send"
   -> POST /v1/intent/confirm   (server builds the PTB, mints a token bound to sha256(bytes))
   -> client signs the bytes locally with zkLogin
   -> POST /v1/intent/execute   (server re-verifies the token against the bytes, then submits)
   -> sponsored transaction settles, digest shown on a testnet explorer
```

---

## 7. Architecture at a Glance

```
+---------------------- Client (Expo: iOS, Android, Web) -----------------------+
|  Expo Router, React 19, NativeWind.                                          |
|  Native: NativeTabs bar.  Web wide: sidebar.  Web narrow: bottom bar.        |
|  Send chat | Fact Checker | Recipients | History | Budget | Guardians        |
+-------------------------------------+---------------------------------------- +
                                      |  HTTPS (JSON)
+-------------------------------------v---------------------------------------- +
|            Backend (Node http, TypeScript, Prisma / SQLite)                  |
|                                                                             |
|   Intent layer          Safety / verdict layer        Settlement layer      |
|   ------------           ---------------------         ----------------      |
|   Gonka Router     -->   deterministic consensus  -->  Sui SDK: build PTB,   |
|   (parse, verify,       (no LLM here):                 confirmation token,   |
|    fact-check)           CLEAR / WARN / DISPUTED       sponsored submit      |
|        |                                                     |              |
|   NewsAPI (evidence)                                  move/fact_check event  |
|                                                      on-chain received-tx   |
|                                                      reconstruction         |
+---------------------------------------------------------------------------- -+
```

---

## 8. Tech Stack

- **Client:** Expo SDK 57, Expo Router 6, React 19, React Native 0.86 (New Architecture), NativeWind, `@mysten/dapp-kit` / `@mysten/enoki`.
- **Backend:** Node.js (`node:http`), TypeScript, Prisma ORM + SQLite, Zod.
- **Blockchain:** Sui (testnet), `@mysten/sui` (`transactions`, `grpc`, `keypairs`, `zklogin`), Enoki, Move (`fact_check` package).
- **AI:** Gonka Router (Anthropic Messages API) - DeepSeek V4 Flash, MiniMax M2.7, Kimi K2.6.
- **Evidence:** NewsAPI.

## 9. Repository Layout

```
app/                      Expo Router screens (native + .web splits)
  (app)/send.tsx          Send screen - owns API calls, signing, records
  (app)/history.tsx       Transaction history (sent + received)
components/send/          send-chat, fact-check-sheet, reasoning-trace, manual-sheet
lib/                      auth adapters, Sui helpers, intent client, i18n, polyfills
server/src/
  gonka/                  the single LLM client (Anthropic Messages API over Gonka Router)
  safety/                 parse-intent, consensus, review, fixtures  (payment safety layer)
  factcheck/              newsapi, assess-claim, verdict, on-chain    (AI Fact Checker)
  intent/                 confirmation tokens
  transactions/           store, on-chain (received-transfer reconstruction)
  recurring/ guardians/ budget/ recipients/
move/fact_check/          Move package - ClaimChecked event registry
shared/contracts.ts       Zod schemas shared by client and server
prisma/schema.prisma      SQLite schema
```

## 10. Running Locally

```bash
# 1. Env files (copy the templates, fill in real keys)
cp .env.example .env.local
cp server/.env.example server/.env
cp prisma/.env.example prisma/.env
#   server/.env needs:  GONKA_API_KEY, NEWSAPI_KEY
#   optional:           FACTCHECK_PACKAGE_ID, FACTCHECK_SIGNER_SECRET_KEY (on-chain verdicts)
#                       ENOKI_API_KEY, EXPO_PUBLIC_GOOGLE_CLIENT_ID (real zkLogin)
#   set DEMO_MODE=false for live Gonka calls (fixtures otherwise)

# 2. Install (also runs prisma generate)
npm install

# 3. Backend - applies DB migrations on boot
npm run server

# 4. App
npx expo start
```

Verification: `npm run typecheck` - `npm run typecheck:server` - `npm run test:server` - `npm run lint`.

## 11. Demo Script

One continuous story, not a feature tour:

1. A parent abroad sends USDC to their child's Sui address - near-zero fee, instant, any country. It appears in the child's **History as "Received"** (detected on chain).
2. The child types *"Send my brother 40 USDC, he messaged me on Facebook about an urgent investment with 10x returns."*
3. The **dual-AI safety layer** flags it: scam-pattern narrative + urgency language + a first-time recipient. The **AI Fact Checker** searches real news for the investment claim, two Gonka models cross-verify against what it finds, and the report shows the Truth Score, the reasoning, and **the Gonka Request IDs** - visible proof the AI did real work.
4. The user reads the warning and decides. If they proceed, they confirm, sign with zkLogin, and Sui executes the sponsored PTB - the digest is shown on a testnet explorer.
5. The dashboard reflects the updated spending breakdown and the next scheduled payment.

---

## 12. Honest Limitations

- The safety layer is **heuristic**. It flags patterns; it does not guarantee scam detection, and it never blocks a transfer - a false positive on a real emergency is worse than an ignored warning.
- The fact-checker is only as good as **NewsAPI coverage**. Niche or very recent claims often return `UNVERIFIABLE`, and the system reports that honestly rather than guessing.
- Pasting a URL or tweet **does not fetch its contents** - the pasted text itself is the claim.
- Received-transfer detection reconstructs from **currently-owned coin objects**, then persists what it finds. A transfer received and then immediately spent *before its first detection* can be missed; once detected and persisted, it is permanent.
- Recurring payments are **off-chain scheduled** with a check-on-open confirmation, not unattended on-chain automation - a deliberate choice given the non-custodial design.
- Testnet only. Existing USDC, no custom token, no fiat off-ramp.
