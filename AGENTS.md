# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Platforms: iOS, Android, and web are all first-class

The app must run and work **properly** on iPhone, Android, and a desktop web browser. This is not "native app with a web fallback": all three are shipping targets and all three are demoed. A change that only works on one platform is not finished.

- **The UI adapts to each platform** and uses the pattern that is idiomatic there:
  - iOS / Android: a real native bottom tab bar via Expo Router `NativeTabs` (`app/(app)/_layout.tsx`), so it picks up the system tab bar (Liquid Glass on iOS 26, the standard translucent bar otherwise) and SF Symbols on iOS.
  - Web, wide viewport (laptop/desktop): a left sidebar.
  - Web, narrow viewport (resized or mobile browser): a bottom bar.
  - The native and web shells are split with `_layout.tsx` / `_layout.web.tsx`.
- **Respect device safe areas**: the status bar / notch at the top, and the home indicator plus the translucent tab bar at the bottom. Every screen pads its content clear of them (see `components/screen.tsx`).
- **Platform-specific auth/wallet behavior is expected** (e.g. real Google zkLogin runs on web today; native uses a local demo wallet until a dev build exists). Build these as explicit per-platform adapters behind one shared interface. Never assume parity, never let one platform silently break.
- **Verify every change on all three** before calling it done: iPhone (Expo Go or a dev build), an Android device or emulator, and a browser at both wide and narrow widths.

# RemitGuard AI — Project Brief

**Purpose of this document:** This is a complete project context brief for RemitGuard AI, written to be handed to an LLM (e.g. a coding assistant) as background before building. It consolidates the problem, solution, architecture, tech stack, scope boundaries, and build order.

---

## 1. Problem Statement

Foreign workers and international students in Malaysia regularly need to send part of their earnings or receive support money across borders — e.g. "every month, I need to send money to my family," or a parent abroad topping up a student's living expenses.

This recurring task creates friction in several ways:
- Traditional remittance (bank wires, money transfer services) is slow and expensive — the global average remittance cost is around 6.36% of the amount sent, with banks specifically averaging closer to 15%.
- Managing repeated transfers to multiple recipients, changing amounts, and occasional one-off payments (school fees, emergencies) is easy to lose track of.
- Remittance is also a common target for scams — "urgent family emergency, send money now" social engineering specifically preys on people sending money to relatives.

## 2. Solution Overview

RemitGuard AI lets a user manage cross-border money transfers through natural-language instructions (e.g. *"Send Mum 150 USDC every month"* or *"This month send Mum an extra 30 USDC for school fees"*). An AI layer (via Gonka Router) parses the instruction into a structured payment plan, a **dual-AI safety layer** checks it for scam-risk patterns, the user confirms, and Sui executes the transfer as a stablecoin payment with near-zero fees and instant settlement — regardless of which countries are involved.

**One-sentence pitch:** *RemitGuard helps people manage regular family remittances as easily as sending a message, with an AI safety layer that catches likely scams before money moves, and stablecoin settlement handled by Sui.*

## 3. Target Users

- Foreign workers in Malaysia sending money home to family.
- International students receiving support from parents/family abroad.
- Anyone managing recurring or ad-hoc cross-border transfers to a small set of known recipients.

## 4. Core Features

### 4.1 Natural-language transfer instructions
User types a plain-language instruction. The system extracts: recipient, amount, type (one-time vs. recurring), and any special notes (e.g. "for school fees"). User sees the structured plan and must explicitly confirm before anything executes — the AI never signs or executes on its own.

### 4.2 Dual-AI Safety Layer (the differentiating feature)
Before a transfer executes, it passes through a verification pipeline:
1. **Parser agent** — Model A (via Gonka Router) extracts structured intent from the instruction.
2. **Verifier agent** — Model B (a different model via Gonka Router) independently re-parses the same instruction. Disagreement between the two is the first flag.
3. **Reason check** — each model gives a short rationale for its read of the instruction (e.g. flags urgency language, unusually large amount, brand-new recipient).
4. **Recipient check** — deterministic lookup: is this a known/saved recipient, or a first-time one? First-time + urgent phrasing + high amount is the strongest combined risk signal.
5. **Safety/consensus logic** — deterministic code (not another AI call) combines the above into a risk verdict. If the two models diverge significantly, the system does **not** silently average — it surfaces "Disputed, please review" and may trigger a third tie-breaking model call.
6. **Confirmation screen** — shows the structured plan, the safety verdict/reasoning, and the Gonka Request IDs from each model call, before the user approves.

**Framing note:** This is described as "an AI safety check," not "scam detection" or "fraud prevention" — it's heuristic pattern-flagging, not a guarantee, and should never be overclaimed. The system **never auto-blocks** a transfer — it always allows the user to proceed after a warning, since false positives on legitimate urgent transfers (real emergencies) are worse than an ignored warning.

### 4.3 Recipient management
A simple saved-recipient book (name → Sui address / wallet mapping) so the AI can resolve "Mum" or "Dad" instead of requiring raw addresses.

### 4.4 Recurring transfers with reconciliation logic
Recurring rules (recipient, amount, frequency, next trigger date) are stored and a scheduler re-triggers execution automatically — this is **not** native on-chain automation; it's an off-chain scheduler that re-submits a PTB on schedule. Be explicit about this distinction rather than implying Sui itself runs cron jobs.

**Duplicate-payment edge case:** When a scheduled date arrives, the system checks the transaction log for a manual transfer to the same recipient since the last trigger. If none is found, it auto-sends (this preserves the "set and forget" value proposition). If a recent manual transfer is found, it does **not** auto-fire — instead it prompts the user: send anyway, skip this month, or adjust the amount. This check is deterministic (a log query), not AI-guessed matching, to avoid false positives/negatives. Matching is done on recipient + time window, not exact amount (a parent might send a different amount for unrelated reasons). "Skip" simply resets to next month's trigger date — no catch-up logic.

### 4.5 Spending breakdown & upcoming payments
- **Spending breakdown**: deterministic aggregation of the transaction log — totals by recipient, recurring vs. one-off split, this month vs. history. AI (Gonka) can optionally answer freeform questions over this data conversationally (e.g. "how much did I send this month"), but the underlying math is always deterministic, not AI-computed.
- **Upcoming payments**: a simple query over the recurring-rules table sorted by next trigger date.

## 5. Technical Architecture

**Layered design:**
1. **Intent layer (Gonka Router)** — stateless API calls for natural-language parsing, reasoning/explanation, and the dual-model safety check. OpenAI-SDK compatible; different models can be swapped via the `model` parameter (e.g. Qwen vs. Kimi/MiniMax) for genuine cross-verification.
2. **Confirmation & execution layer (backend + Sui SDK)** — backend takes the user-confirmed plan, constructs a Programmable Transaction Block (PTB), and submits it as a **sponsored transaction** so the user pays no gas.
3. **Settlement layer (Sui blockchain)** — the PTB executes atomically (transfer + any record/rule update happen together, not as separate steps that could desync).

**Core architectural principle (carried from an earlier related design, "AI reasons, rules calculate, chain executes"):** AI never performs deterministic math or executes a transaction directly. It parses, explains, and flags. Rules-based code decides. Sui executes only after explicit human confirmation.

## 6. Sui SDK Components Used

- **`@mysten/sui/transactions`** — the `Transaction`/PTB builder; core send-money logic (split coin, transfer, sign, execute).
- **`@mysten/sui/client`** — `SuiClient` for reading balances/objects and submitting transactions.
- **zkLogin** (via **Enoki**, Mysten's integrated service) — maps a normal Google/OAuth sign-in to a Sui address; no seed phrases for the end user.
- **Sponsored transactions** (via Enoki or Sui Gas Pool) — app pays gas on the user's behalf; not a single SDK call but a "gas station" service integration.
- **`@mysten/sui/faucet`** — programmatic devnet/testnet funding for demo/dev wallets.
- **`@mysten/dapp-kit-react`** — React hooks for wallet connection/state on the frontend.

## 7. Explicit Scope Boundaries (say these out loud in the pitch, don't let a judge assume otherwise)

- **No custom stablecoin.** Use existing testnet USDC on Sui. Do not claim to mint a new MYR-pegged token — that invites unanswerable regulatory questions about what backs the peg.
- **No fiat off-ramp built.** Converting stablecoins to spendable local currency happens via existing SC-licensed exchanges in Malaysia (e.g. Luno, Tokenize) — this is treated as the final mile, explicitly out of scope, not something RemitGuard replaces. Money that stays inside a closed-loop spending network (e.g. campus vendors) never needs this step at all.
- **No lending/microloan features.** Cut entirely — real lending logic plus regulatory exposure is not worth the risk for a hackathon demo.
- **Recurring transfers are backend-scheduled, not on-chain-automated.** Be precise about this; don't imply Sui itself runs the schedule.
- **The safety layer is heuristic, not guaranteed fraud detection.** Never overclaim its accuracy or reliability.

## 8. Why Blockchain (Sui) at All — the honest answer

Malaysia already has DuitNow, a free, instant, 24/7 domestic bank transfer system — so speed/cost is **not** the argument for domestic transfers. The real, defensible arguments are:
1. **An AI agent can act as a first-class actor.** No bank API lets third-party software (let alone an AI agent) construct and submit a transaction on a user's behalf without a licensed fintech partnership. On Sui, that's a PTB your backend builds directly.
2. **Independent verifiability.** A parent or auditor can check a public Sui explorer to confirm a transfer/limit was enforced, rather than trusting an app's backend claims.
3. **Cross-border reach DuitNow doesn't have.** DuitNow's cross-border capability is currently limited (e.g. Singapore linkage only) — it doesn't help remittance to/from most countries, which is exactly where stablecoin rails add real value.

## 9. Hackathon Context

- **Team:** small group of backend/frontend generalists, no prior blockchain experience.
- **Build window:** 10 days.
- **Target tracks:** Sui "Payments & Stablecoins" and "AI x Sui" (same codebase can plausibly qualify for both — the AI agent constructing/executing PTBs is the feature that satisfies both simultaneously).
- **Single submission constraint:** only one project can be submitted — RemitGuard AI is it. Gonka Router is used deeply within RemitGuard (the dual-AI safety layer) rather than building a separate standalone product for Gonka's own "AI for Society" track, since that track's judging spec (a public-value fact-checker-style tool) doesn't match a fintech product regardless of how well Gonka is integrated into it.

## 10. Build Order (priority sequence)

1. zkLogin auth + wallet creation (via Enoki).
2. Core payment flow: send/receive testnet USDC via a PTB. Get one clean, reliable transaction working before anything else.
3. Sponsored transactions (zero gas prompts for the user).
4. Natural-language parsing → structured payment plan (single model first).
5. Dual-AI safety layer: add the second verifying model, consensus/disagreement logic, and the confirmation screen showing the safety verdict + Gonka Request IDs.
6. Recurring transfers + the duplicate-payment reconciliation check.
7. Spending breakdown + upcoming payments views.
8. Recipient book (simple name → address map).
9. Polish UX/error handling; rehearse one full end-to-end demo story (parent sends → AI safety-checks → student receives → AI auto-saves/recurs → dashboard reflects it) rather than a feature tour. Record a backup video.

## 11. Demo Narrative (for the pitch/video)

Structure the live demo as **one continuous user story**, not a feature list:
1. A parent abroad sends stablecoins to their child's wallet — instant, near-zero fee, regardless of country.
2. The user types a natural-language instruction to send part of it onward or set up a recurring transfer.
3. The dual-AI safety layer flags something (a first-time recipient, or urgent-sounding phrasing) and shows a warning with reasoning and Request IDs — this is the standout demo moment, since it visibly proves the AI is doing real verification work, not decoration.
4. User confirms, Sui executes the PTB, transaction settles instantly and visibly (e.g. shown on a testnet explorer).
5. Dashboard shows updated spending breakdown and the next upcoming scheduled payment.