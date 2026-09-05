import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { checkClaim, type TransferOutcome } from '@/lib/intent/client';
import type { Recipient } from '@/lib/recipients/use-recipients';
import { explorerTxUrl } from '@/lib/sui/network';
import type { ClaimCheckResult, IntentReview, ResolvedPlan, SafetyFlag } from '@/shared/contracts';

import { FactCheckSheet } from './fact-check-sheet';
import { ManualSheet, type ManualInput } from './manual-sheet';
import { ReasoningTrace, type TraceStep } from './reasoning-trace';

const EXAMPLES = [
  'Send Mum 100 USDC for groceries',
  'Send Dad 50 USDC every month for his phone bill',
  'This month send Mum an extra 30 USDC for school fees',
];

const GREETING =
  "Hi! Tell me who to pay and how much - e.g. \"Send Mum 150 USDC for school fees\". I'll walk you through the safety check before anything moves.";

/** Checking every fragment a model calls a "claim" doesn't add value past a
 * handful, and inflates one report into an overwhelming list. */
const MAX_CLAIMS_CHECKED = 3;

type TextTone = 'default' | 'info' | 'warn' | 'good' | 'error';
type ClaimOutcome = ClaimCheckResult | { error: true };
type ReportDecision = 'pending' | 'continue' | 'cancel';

type Item =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'text'; text: string; tone: TextTone }
  | { id: string; kind: 'trace'; steps: TraceStep[] }
  | {
      id: string;
      kind: 'report';
      flags: SafetyFlag[];
      claims: string[];
      skippedClaimCount: number;
      claimResults: Record<string, ClaimOutcome>;
      claimsLoading: boolean;
      decision: ReportDecision;
    }
  | {
      id: string;
      kind: 'ready';
      plan: ResolvedPlan;
      saveName: string;
      status: 'pending' | 'sent' | 'cancelled';
      busy: boolean;
    }
  | {
      id: string;
      kind: 'receipt';
      outcome: TransferOutcome;
      plan: ResolvedPlan;
      saveNotice: string | null;
      saveOk: boolean;
    };

/** What the transcript is currently waiting on the user to answer (outside of
 * a report card's own Continue/Cancel, which lives on the item itself). */
type Pending = { kind: 'save-yesno' } | { kind: 'save-name' } | null;

type Stage = 'idle' | 'thinking' | 'dialogue' | 'ready' | 'sending';

let uid = 0;
function nextId(): string {
  uid += 1;
  return `i${uid}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

function describeManual(input: ManualInput): string {
  const name = input.recipient?.name ?? shortAddress(input.address);
  const when =
    input.frequency === 'MONTHLY'
      ? ` every month on day ${input.monthlyDay ?? new Date().getDate()}`
      : input.frequency === 'DAILY'
        ? ' every day'
        : '';
  return `Send ${input.amount} ${input.asset} to ${name}${when}`;
}

function summaryLine(plan: ResolvedPlan): string {
  const when =
    plan.frequency === 'MONTHLY'
      ? ` every month on day ${plan.monthlyDay ?? 1}`
      : plan.frequency === 'DAILY'
        ? ' every day'
        : '';
  const first = plan.recipientKnown ? '' : ' - this is the first time you have sent to this address';
  return `Got it. Send ${plan.amount} ${plan.asset} to ${plan.recipientName}${when}.${first}`;
}

function modelReadsLine(review: IntentReview): string | null {
  const lines = review.modelReads
    .filter((r) => r.ok && r.intent)
    .map((r) => `${r.role === 'parser' ? 'Parser' : 'Verifier'} (${r.model}): ${r.intent?.rationale}`);
  return lines.length > 0 ? `Here is what each model read:\n${lines.join('\n')}` : null;
}

/** Collapses near-duplicate claims (the parser and verifier often phrase the
 * same underlying claim slightly differently) by word-overlap ratio, so one
 * real-world claim doesn't eat two of the few report slots. */
function dedupeSimilarClaims(claims: string[]): string[] {
  const wordsOf = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
  const kept: string[] = [];
  const keptWordSets: Set<string>[] = [];
  for (const claim of claims) {
    const words = wordsOf(claim);
    const isDuplicate = keptWordSets.some((existing) => {
      const overlap = [...words].filter((w) => existing.has(w)).length;
      return overlap / Math.max(words.size, existing.size, 1) > 0.6;
    });
    if (!isDuplicate) {
      kept.push(claim);
      keptWordSets.push(words);
    }
  }
  return kept;
}

const VERDICT_BADGE: Record<ClaimCheckResult['verdict'], { label: string; bg: string; fg: string }> = {
  SUPPORTED: { label: 'Supported', bg: 'bg-emerald-500/15', fg: 'text-emerald-300' },
  CONTRADICTED: { label: 'Contradicted', bg: 'bg-red-500/15', fg: 'text-red-300' },
  DISPUTED: { label: 'Disputed', bg: 'bg-amber-500/15', fg: 'text-amber-300' },
  UNVERIFIABLE: { label: 'Unverifiable', bg: 'bg-slate-700/40', fg: 'text-slate-300' },
};

/** One honest sentence about what actually happened - distinguishing "found
 * nothing at all" from "found coverage but it doesn't settle this," which is
 * a real difference the old copy blurred together. */
function claimSummary(result: ClaimCheckResult): string {
  if (result.evidence.length === 0) {
    return 'No real news coverage could be found for this.';
  }
  if (result.verdict === 'UNVERIFIABLE') {
    return 'Coverage exists, but it does not clearly confirm or refute this.';
  }
  const matching = result.modelReads.find(
    (r) => r.ok && r.rationale && r.stance === (result.verdict === 'SUPPORTED' ? 'supports' : 'contradicts'),
  );
  return matching?.rationale ?? (result.verdict === 'SUPPORTED' ? 'Corroborated by real coverage.' : 'Refuted by real coverage.');
}

export type ConfirmResult =
  | { status: 'sent'; outcome: TransferOutcome; saveNotice: string | null; saveOk: boolean }
  /** A guardian policy requires a second approval before this can execute at all. */
  | { status: 'held'; expiresAt: string };

/**
 * The whole Send experience as one continuous conversation: type a message or
 * tap the pencil for a manual entry, watch the safety pipeline reason about it,
 * then review a single consolidated report (every flag, every claim checked in
 * parallel against real news) before one Continue/Cancel decision. History
 * persists across turns - like any chat, not a form that resets.
 */
export function SendChat({
  recipients,
  onReviewMessage,
  onReviewManual,
  onConfirm,
}: {
  recipients: Recipient[];
  onReviewMessage: (message: string) => Promise<IntentReview>;
  onReviewManual: (input: ManualInput) => Promise<IntentReview>;
  onConfirm: (plan: ResolvedPlan, saveName: string) => Promise<ConfirmResult>;
}) {
  const [items, setItems] = useState<Item[]>(() => [{ id: nextId(), kind: 'text', tone: 'default', text: GREETING }]);
  const [stage, setStage] = useState<Stage>('idle');
  const [pending, setPending] = useState<Pending>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [draft, setDraft] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [factCheckOpen, setFactCheckOpen] = useState(false);
  const reviewRef = useRef<IntentReview | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const push = (item: Item) => setItems((prev) => [...prev, item]);
  const say = (text: string, tone: TextTone = 'default') => push({ id: nextId(), kind: 'text', text, tone });
  const sayUser = (text: string) => push({ id: nextId(), kind: 'user', text });

  const updateTrace = (mutate: (steps: TraceStep[]) => TraceStep[]) => {
    setItems((prev) => {
      const idx = [...prev].reverse().findIndex((it) => it.kind === 'trace');
      if (idx === -1) return prev;
      const i = prev.length - 1 - idx;
      const traceItem = prev[i] as Extract<Item, { kind: 'trace' }>;
      const copy = [...prev];
      copy[i] = { ...traceItem, steps: mutate(traceItem.steps) };
      return copy;
    });
  };

  const canCompose = stage === 'idle';

  // --- the two ways a turn can start -------------------------------------

  const startDescribe = async (message: string) => {
    sayUser(message);
    push({
      id: nextId(),
      kind: 'trace',
      steps: [
        { id: 'read', label: 'Reading your message', sublabel: 'Parser model', status: 'active' },
        { id: 'cross', label: 'Cross-checking independently', sublabel: 'Verifier model', status: 'active' },
        { id: 'rules', label: 'Checking recipient & risk rules', status: 'pending' },
      ],
    });
    setStage('thinking');
    try {
      const review = await onReviewMessage(message);
      await settleReview(review);
    } catch (err) {
      updateTrace((s) => s.map((x) => (x.status === 'done' ? x : { ...x, status: 'error' })));
      say(err instanceof Error ? err.message : 'Could not run the safety check.', 'error');
      setStage('idle');
    }
  };

  const startManual = async (input: ManualInput) => {
    sayUser(describeManual(input));
    push({
      id: nextId(),
      kind: 'trace',
      steps: [{ id: 'rules', label: 'Checking recipient & risk rules', status: 'active' }],
    });
    setStage('thinking');
    try {
      const review = await onReviewManual(input);
      await settleReview(review);
    } catch (err) {
      updateTrace((s) => s.map((x) => ({ ...x, status: 'error' })));
      say(err instanceof Error ? err.message : 'Could not run the safety check.', 'error');
      setStage('idle');
    }
  };

  // --- shared continuation once a review comes back -----------------------

  const settleReview = async (review: IntentReview) => {
    reviewRef.current = review;
    updateTrace((s) => s.map((x) => (x.id === 'rules' ? x : { ...x, status: 'done' })));
    await delay(200);
    updateTrace((s) => s.map((x) => (x.id === 'rules' ? { ...x, status: 'done' } : x)));

    if (review.status === 'cannot_execute') {
      if (review.flags.length > 0) {
        review.flags.forEach((f) => say(f.detail, 'warn'));
      } else {
        say("I couldn't turn that into a transfer. Try rephrasing, or enter it manually.", 'error');
      }
      setStage('idle');
      return;
    }

    say(summaryLine(review.plan!), 'default');
    const reads = modelReadsLine(review);
    if (reads) say(reads, 'default');

    const distinctClaims = dedupeSimilarClaims(review.claims);
    const claimsToCheck = distinctClaims.slice(0, MAX_CLAIMS_CHECKED);
    const skippedClaimCount = distinctClaims.length - claimsToCheck.length;
    const hasClaims = claimsToCheck.length > 0;

    if (review.flags.length === 0 && !hasClaims) {
      goToSaveOrReady();
      return;
    }

    if (hasClaims) {
      updateTrace((s) => [
        ...s,
        {
          id: 'claims',
          label: `Verifying ${claimsToCheck.length} claim${claimsToCheck.length > 1 ? 's' : ''} you mentioned`,
          status: 'active',
        },
      ]);
    }

    const reportId = nextId();
    push({
      id: reportId,
      kind: 'report',
      flags: review.flags,
      claims: claimsToCheck,
      skippedClaimCount,
      claimResults: {},
      claimsLoading: hasClaims,
      decision: 'pending',
    });
    setStage('dialogue');

    if (hasClaims) {
      const results = await Promise.all(
        claimsToCheck.map(async (claim): Promise<[string, ClaimOutcome]> => {
          try {
            return [claim, await checkClaim(claim)];
          } catch {
            return [claim, { error: true }];
          }
        }),
      );
      const claimResults: Record<string, ClaimOutcome> = {};
      for (const [claim, result] of results) claimResults[claim] = result;
      setItems((prev) =>
        prev.map((it) => (it.id === reportId && it.kind === 'report' ? { ...it, claimResults, claimsLoading: false } : it)),
      );
      updateTrace((s) => s.map((x) => (x.id === 'claims' ? { ...x, status: 'done' } : x)));
    }
  };

  const answerReport = (reportId: string, proceed: boolean) => {
    sayUser(proceed ? 'Continue' : 'Cancel');
    setItems((prev) =>
      prev.map((it) => (it.id === reportId && it.kind === 'report' ? { ...it, decision: proceed ? 'continue' : 'cancel' } : it)),
    );
    if (!proceed) {
      say('Transfer cancelled. Nothing was sent.', 'default');
      setStage('idle');
      return;
    }
    goToSaveOrReady();
  };

  // --- offer to save a new recipient, then show the confirm card -----------

  const goToSaveOrReady = () => {
    const plan = reviewRef.current?.plan;
    if (!plan) return;
    if (plan.recipientKnown) {
      finalizeReady(plan, '');
      return;
    }
    say(
      plan.recipientNameFromMessage
        ? `Want me to save this recipient as "${plan.recipientName}" for next time?`
        : 'This address is not in your recipient book. Save it for next time?',
      'default',
    );
    setPending({ kind: 'save-yesno' });
    setStage('dialogue');
  };

  const answerSaveYesNo = (yes: boolean) => {
    sayUser(yes ? 'Yes' : 'No');
    const plan = reviewRef.current!.plan!;
    if (!yes) {
      finalizeReady(plan, '');
      return;
    }
    if (plan.recipientNameFromMessage) {
      say(`Saved as "${plan.recipientName}".`, 'good');
      finalizeReady(plan, plan.recipientName);
      return;
    }
    say('What would you like to call them?', 'default');
    setPending({ kind: 'save-name' });
  };

  const submitName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    sayUser(trimmed);
    say(`Saved as "${trimmed}".`, 'good');
    setNameDraft('');
    finalizeReady(reviewRef.current!.plan!, trimmed);
  };

  const finalizeReady = (plan: ResolvedPlan, saveName: string) => {
    setPending(null);
    push({ id: nextId(), kind: 'ready', plan, saveName, status: 'pending', busy: false });
    setStage('ready');
  };

  // --- confirm & send ---------------------------------------------------

  const confirmSend = async (item: Extract<Item, { kind: 'ready' }>) => {
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, busy: true } : it)));
    setStage('sending');
    try {
      const result = await onConfirm(item.plan, item.saveName);
      if (result.status === 'held') {
        setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, busy: false } : it)));
        say(
          `Your guardian needs to approve this payment first. This request expires ${new Date(result.expiresAt).toLocaleString()}. Once approved, press Confirm & Send again.`,
          'info',
        );
        setStage('ready');
        return;
      }
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, busy: false, status: 'sent' } : it)));
      push({ id: nextId(), kind: 'receipt', outcome: result.outcome, plan: item.plan, saveNotice: result.saveNotice, saveOk: result.saveOk });
      setStage('idle');
    } catch (err) {
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, busy: false } : it)));
      say(err instanceof Error ? err.message : 'The transfer failed.', 'error');
      setStage('ready');
    }
  };

  const cancelReady = (item: Extract<Item, { kind: 'ready' }>) => {
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: 'cancelled' } : it)));
    say('Transfer cancelled. Nothing was sent.', 'default');
    setStage('idle');
  };

  // --- composer -----------------------------------------------------------

  const submitMessage = () => {
    const trimmed = draft.trim();
    if (trimmed.length < 3 || !canCompose) return;
    setDraft('');
    void startDescribe(trimmed);
  };

  const submitManual = (input: ManualInput) => {
    setManualOpen(false);
    void startManual(input);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      className="flex-1"
    >
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 20 }}
        className="flex-1"
      >
        {items.map((item) => {
          if (item.kind === 'user') return <UserBubble key={item.id} text={item.text} />;
          if (item.kind === 'text') return <TextBubble key={item.id} text={item.text} tone={item.tone} />;
          if (item.kind === 'trace') return <ReasoningTrace key={item.id} title="RemitGuard AI" steps={item.steps} />;
          if (item.kind === 'report') return <ReportCard key={item.id} item={item} onAnswer={answerReport} />;
          if (item.kind === 'ready') return <ReadyCard key={item.id} item={item} onConfirm={confirmSend} onCancel={cancelReady} />;
          return (
            <ReceiptCard
              key={item.id}
              outcome={item.outcome}
              plan={item.plan}
              saveNotice={item.saveNotice}
              saveOk={item.saveOk}
            />
          );
        })}

        {pending?.kind === 'save-yesno' ? (
          <ChoiceRow>
            <Choice label="Yes, save" tone="primary" onPress={() => answerSaveYesNo(true)} />
            <Choice label="No thanks" tone="outline" onPress={() => answerSaveYesNo(false)} />
          </ChoiceRow>
        ) : null}

        {pending?.kind === 'save-name' ? (
          <View className="max-w-[92%] gap-2 self-start pl-1">
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="e.g. Rou Xuen"
              placeholderTextColor="#475569"
              autoFocus
              onSubmitEditing={submitName}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
            <ChoiceRow>
              <Choice label="Save" tone="primary" onPress={submitName} disabled={nameDraft.trim().length === 0} />
              <Choice label="Skip" tone="outline" onPress={() => finalizeReady(reviewRef.current!.plan!, '')} />
            </ChoiceRow>
          </View>
        ) : null}
      </ScrollView>

      <Composer
        value={draft}
        onChangeText={setDraft}
        onSend={submitMessage}
        onOpenManual={() => setManualOpen(true)}
        onOpenFactCheck={() => setFactCheckOpen(true)}
        disabled={!canCompose}
        showExamples={items.length <= 1}
        onPickExample={(ex) => setDraft(ex)}
      />

      <ManualSheet visible={manualOpen} recipients={recipients} onClose={() => setManualOpen(false)} onSubmit={submitManual} />
      <FactCheckSheet visible={factCheckOpen} onClose={() => setFactCheckOpen(false)} />
    </KeyboardAvoidingView>
  );
}

// --- presentation -----------------------------------------------------------

function UserBubble({ text }: { text: string }) {
  return (
    <View className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5">
      <Text className="text-sm font-medium text-white">{text}</Text>
    </View>
  );
}

const TONE_STYLE: Record<TextTone, { border: string; bg: string; icon: keyof typeof Ionicons.glyphMap; color: string; label: string | null }> = {
  default: { border: 'border-slate-800', bg: 'bg-slate-900', icon: 'sparkles', color: '#60a5fa', label: null },
  info: { border: 'border-sky-400/25', bg: 'bg-sky-400/10', icon: 'information-circle', color: '#38bdf8', label: 'Note' },
  warn: { border: 'border-amber-400/30', bg: 'bg-amber-400/10', icon: 'warning', color: '#fbbf24', label: 'Warning' },
  good: { border: 'border-emerald-400/30', bg: 'bg-emerald-400/10', icon: 'checkmark-circle', color: '#34d399', label: null },
  error: { border: 'border-red-400/30', bg: 'bg-red-400/10', icon: 'alert-circle', color: '#f87171', label: 'Error' },
};

function TextBubble({ text, tone }: { text: string; tone: TextTone }) {
  const c = TONE_STYLE[tone];
  return (
    <View className={`max-w-[92%] flex-row items-start gap-2.5 self-start rounded-2xl rounded-bl-sm border px-4 py-3 ${c.border} ${c.bg}`}>
      <Ionicons name={c.icon} size={16} color={c.color} style={{ marginTop: 1 }} />
      <View className="flex-1">
        {c.label ? (
          <Text className="mb-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: c.color }}>
            {c.label}
          </Text>
        ) : null}
        <Text className="text-sm leading-5 text-slate-200">{text}</Text>
      </View>
    </View>
  );
}

function ReportCard({
  item,
  onAnswer,
}: {
  item: Extract<Item, { kind: 'report' }>;
  onAnswer: (id: string, proceed: boolean) => void;
}) {
  const hasWarnFlag = item.flags.some((f) => f.severity === 'warn');
  const claimResults = item.claims
    .map((claim) => item.claimResults[claim])
    .filter((r): r is ClaimCheckResult => !!r && !('error' in r));
  const hasBadClaim = claimResults.some((r) => r.verdict === 'CONTRADICTED' || r.verdict === 'DISPUTED');
  const attention = hasWarnFlag || hasBadClaim;
  const decided = item.decision !== 'pending';

  return (
    <View
      className={`w-full max-w-[92%] gap-3 self-start rounded-2xl border p-4 ${
        attention ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-900'
      }`}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons name={attention ? 'shield-half' : 'shield-checkmark'} size={18} color={attention ? '#fbbf24' : '#34d399'} />
        <Text className={`text-sm font-bold ${attention ? 'text-amber-300' : 'text-emerald-300'}`}>
          {attention ? 'Review before you send' : 'Safety check complete'}
        </Text>
      </View>

      {item.flags.length > 0 ? (
        <View className="gap-2">
          {item.flags.map((f, i) => (
            <View key={`${f.code}-${i}`} className="flex-row items-start gap-2">
              <Ionicons
                name={f.severity === 'warn' ? 'warning' : 'information-circle'}
                size={14}
                color={f.severity === 'warn' ? '#fbbf24' : '#38bdf8'}
                style={{ marginTop: 2 }}
              />
              <Text className="flex-1 text-xs leading-5 text-slate-300">{f.detail}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {item.claims.length > 0 ? (
        <View className={`gap-2.5 ${item.flags.length > 0 ? 'border-t border-slate-800 pt-2.5' : ''}`}>
          <Text className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Fact-check (real news, not model memory)</Text>
          {item.claimsLoading ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#94a3b8" />
              <Text className="text-xs text-slate-400">Checking against real news...</Text>
            </View>
          ) : (
            item.claims.map((claim) => <ClaimRow key={claim} claim={claim} result={item.claimResults[claim]} />)
          )}
          {!item.claimsLoading && item.skippedClaimCount > 0 ? (
            <Text className="text-[11px] text-slate-500">
              +{item.skippedClaimCount} more mentioned claim{item.skippedClaimCount > 1 ? 's' : ''} not checked individually - treat
              any other specifics as unverified.
            </Text>
          ) : null}
          {!item.claimsLoading ? (
            <Text className="text-[11px] leading-4 text-slate-500">This is an AI safety check, not a guarantee - verify important claims yourself.</Text>
          ) : null}
        </View>
      ) : null}

      {!decided ? (
        <View className="flex-row gap-2 pt-1">
          <Pressable
            accessibilityRole="button"
            disabled={item.claimsLoading}
            onPress={() => onAnswer(item.id, true)}
            className="flex-1 items-center rounded-xl bg-blue-600 px-4 py-3 active:bg-blue-500 disabled:opacity-40"
          >
            <Text className="text-sm font-bold text-white">{item.claimsLoading ? 'Preparing...' : 'Continue'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={item.claimsLoading}
            onPress={() => onAnswer(item.id, false)}
            className="items-center rounded-xl border border-slate-700 px-4 py-3 active:bg-slate-800 disabled:opacity-40"
          >
            <Text className="text-sm font-semibold text-slate-300">Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Text className="text-xs text-slate-500">{item.decision === 'continue' ? 'Continued' : 'Cancelled'}</Text>
      )}
    </View>
  );
}

function ClaimRow({ claim, result }: { claim: string; result: ClaimOutcome | undefined }) {
  if (!result) return null;
  if ('error' in result) {
    return (
      <View className="gap-0.5">
        <Text className="text-xs text-slate-300" numberOfLines={1}>
          &quot;{claim}&quot;
        </Text>
        <Text className="text-[11px] text-slate-500">Could not check - fact-check service unavailable.</Text>
      </View>
    );
  }
  const badge = VERDICT_BADGE[result.verdict];
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <View className={`rounded-full px-2 py-0.5 ${badge.bg}`}>
          <Text className={`text-[10px] font-bold uppercase ${badge.fg}`}>{badge.label}</Text>
        </View>
        <Text className="flex-1 text-xs text-slate-300" numberOfLines={1}>
          &quot;{claim}&quot;
        </Text>
      </View>
      <Text className="pl-1 text-[11px] leading-4 text-slate-500">{claimSummary(result)}</Text>
    </View>
  );
}

function ReadyCard({
  item,
  onConfirm,
  onCancel,
}: {
  item: Extract<Item, { kind: 'ready' }>;
  onConfirm: (item: Extract<Item, { kind: 'ready' }>) => void;
  onCancel: (item: Extract<Item, { kind: 'ready' }>) => void;
}) {
  const { plan } = item;

  if (item.status !== 'pending') {
    return (
      <View className="max-w-[92%] flex-row items-center gap-2 self-start rounded-xl border border-slate-800 bg-slate-900/50 px-3.5 py-2.5 opacity-70">
        <Ionicons
          name={item.status === 'sent' ? 'checkmark-circle' : 'close-circle'}
          size={14}
          color={item.status === 'sent' ? '#34d399' : '#94a3b8'}
        />
        <Text className="text-xs text-slate-400">
          {item.status === 'sent' ? 'Sent' : 'Cancelled'} - {plan.amount} {plan.asset} to {plan.recipientName}
        </Text>
      </View>
    );
  }

  return (
    <View className="w-full max-w-[92%] gap-3 self-start rounded-2xl border border-blue-500/25 bg-slate-900 p-4" style={READY_GLOW}>
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm text-slate-400">Sending</Text>
        <Text className="text-lg font-bold text-white">
          {plan.amount} {plan.asset}
        </Text>
      </View>
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm text-slate-400">To</Text>
        <Text className="text-sm font-semibold text-white">{plan.recipientName}</Text>
      </View>
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          disabled={item.busy}
          onPress={() => onConfirm(item)}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 active:bg-blue-500 disabled:opacity-50"
        >
          {item.busy ? <ActivityIndicator color="#ffffff" size="small" /> : null}
          <Text className="text-sm font-bold text-white">{item.busy ? 'Sending...' : 'Confirm & Send'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={item.busy}
          onPress={() => onCancel(item)}
          className="items-center justify-center rounded-xl border border-slate-700 px-4 py-3.5 active:bg-slate-800 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-slate-300">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReceiptCard({
  outcome,
  plan,
  saveNotice,
  saveOk,
}: {
  outcome: TransferOutcome;
  plan: ResolvedPlan;
  saveNotice: string | null;
  saveOk: boolean;
}) {
  const ok = outcome.status === 'success';
  return (
    <View
      className={`max-w-[92%] gap-2.5 self-start rounded-2xl border p-4 ${
        ok ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-red-500/25 bg-red-500/5'
      }`}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={18} color={ok ? '#34d399' : '#f87171'} />
        <Text className={`text-base font-bold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {ok ? 'Transfer settled' : 'Transfer failed'}
        </Text>
      </View>
      {ok ? (
        <Text className="text-sm text-slate-300">
          {plan.amount} {plan.asset} sent to {plan.recipientName}.
        </Text>
      ) : (
        <Text className="text-sm text-red-300">{outcome.error ?? 'Unknown error.'}</Text>
      )}
      {saveNotice ? (
        <View
          className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 ${
            saveOk ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-amber-400/20 bg-amber-400/10'
          }`}
        >
          <Ionicons name={saveOk ? 'bookmark' : 'alert-circle-outline'} size={13} color={saveOk ? '#34d399' : '#fbbf24'} />
          <Text className={`flex-1 text-xs leading-4 ${saveOk ? 'text-emerald-200' : 'text-amber-200'}`}>{saveNotice}</Text>
        </View>
      ) : null}
      {ok ? (
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(explorerTxUrl(outcome.digest))}>
          <Text className="text-xs font-semibold text-blue-400">View on explorer -&gt;</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ChoiceRow({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-2 self-start pl-1">{children}</View>;
}

function Choice({
  label,
  tone,
  onPress,
  disabled,
}: {
  label: string;
  tone: 'primary' | 'outline';
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`rounded-full px-4 py-2 disabled:opacity-40 ${
        tone === 'primary' ? 'bg-blue-600 active:bg-blue-500' : 'border border-slate-700 active:bg-slate-800'
      }`}
    >
      <Text className={`text-sm font-semibold ${tone === 'primary' ? 'text-white' : 'text-slate-300'}`}>{label}</Text>
    </Pressable>
  );
}

const COMPOSER_MIN_HEIGHT = 44;
const COMPOSER_MAX_HEIGHT = 160;

function Composer({
  value,
  onChangeText,
  onSend,
  onOpenManual,
  onOpenFactCheck,
  disabled,
  showExamples,
  onPickExample,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onOpenManual: () => void;
  onOpenFactCheck: () => void;
  disabled: boolean;
  showExamples: boolean;
  onPickExample: (example: string) => void;
}) {
  const [inputHeight, setInputHeight] = useState(COMPOSER_MIN_HEIGHT);

  // Collapse back to single-line height once the field is cleared (e.g. after
  // sending). Adjusted during render, guarded against the previous value,
  // rather than in a useEffect - see the identical pattern in ManualSheet.
  const [wasEmpty, setWasEmpty] = useState(value === '');
  const isEmpty = value === '';
  if (isEmpty !== wasEmpty) {
    setWasEmpty(isEmpty);
    if (isEmpty) setInputHeight(COMPOSER_MIN_HEIGHT);
  }

  return (
    <View className="gap-2 border-t border-slate-800 bg-slate-950 px-3 pb-2 pt-3">
      {showExamples ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
          {EXAMPLES.map((ex) => (
            <Pressable
              key={ex}
              onPress={() => onPickExample(ex)}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 active:bg-slate-800"
            >
              <Text className="text-xs text-slate-300">{ex}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View className="flex-row items-end gap-2">
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onOpenManual}
          className="h-11 w-11 items-center justify-center rounded-full border border-slate-700 active:bg-slate-800 disabled:opacity-40"
        >
          <Ionicons name="create-outline" size={19} color="#94a3b8" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenFactCheck}
          className="h-11 w-11 items-center justify-center rounded-full border border-slate-700 active:bg-slate-800"
        >
          <Ionicons name="shield-checkmark-outline" size={19} color="#94a3b8" />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Message RemitGuard..."
          placeholderTextColor="#475569"
          editable={!disabled}
          multiline
          onSubmitEditing={onSend}
          onContentSizeChange={(e) =>
            setInputHeight(Math.min(COMPOSER_MAX_HEIGHT, Math.max(COMPOSER_MIN_HEIGHT, e.nativeEvent.contentSize.height)))
          }
          scrollEnabled={inputHeight >= COMPOSER_MAX_HEIGHT}
          style={{ height: inputHeight }}
          className="flex-1 rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm leading-5 text-slate-100"
        />
        <Pressable
          accessibilityRole="button"
          disabled={disabled || value.trim().length < 3}
          onPress={onSend}
          className="h-11 w-11 items-center justify-center rounded-full bg-blue-600 active:bg-blue-500 disabled:opacity-30"
        >
          <Ionicons name="arrow-up" size={20} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

const READY_GLOW = {
  shadowColor: '#3b82f6',
  shadowOpacity: 0.15,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 0 },
  elevation: 2,
} as const;
