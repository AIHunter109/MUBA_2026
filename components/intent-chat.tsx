import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { checkClaim } from '@/lib/intent/client';
import type { ClaimCheckResult, IntentReview, ResolvedPlan, SafetyFlag } from '@/shared/contracts';

type Bubble = {
  id: string;
  from: 'system' | 'user';
  text: string;
  tone?: 'default' | 'warn' | 'good';
};

/** What the chat is currently waiting on the user to answer. */
type Pending =
  | { kind: 'flag'; flag: SafetyFlag }
  | { kind: 'claim-check'; claim: string; result: ClaimCheckResult | null; loading: boolean }
  | { kind: 'save-yesno' }
  | { kind: 'save-name' }
  | null;

let bubbleId = 0;
function nextId(): string {
  bubbleId += 1;
  return `b${bubbleId}`;
}

function summaryLine(plan: ResolvedPlan): string {
  const when = plan.frequency === 'MONTHLY' ? ` every month on day ${plan.monthlyDay ?? 1}` : '';
  const first = plan.recipientKnown ? '' : ' - this is the first time you have sent to this address';
  return `Got it. Send ${plan.amount} ${plan.asset} to ${plan.recipientName}${when}.${first}`;
}

function modelReadsLine(review: IntentReview): string | null {
  const lines = review.modelReads
    .filter((r) => r.ok && r.intent)
    .map((r) => `${r.role === 'parser' ? 'Parser' : 'Verifier'} (${r.model}): ${r.intent?.rationale}`);
  if (lines.length === 0) {
    return null;
  }
  return `Here is what each model read:\n${lines.join('\n')}`;
}

const CLAIM_VERDICT_TEXT: Record<ClaimCheckResult['verdict'], string> = {
  SUPPORTED: 'Supported by real news coverage',
  CONTRADICTED: 'Contradicted by real news coverage',
  DISPUTED: 'The evidence is mixed - the two models read it differently',
  UNVERIFIABLE: 'No real evidence could be found for this claim',
};

function claimTone(verdict: ClaimCheckResult['verdict']): Bubble['tone'] {
  if (verdict === 'SUPPORTED') return 'good';
  if (verdict === 'CONTRADICTED' || verdict === 'DISPUTED') return 'warn';
  return 'default';
}

function claimResultLine(result: ClaimCheckResult): string {
  const parts = [`${CLAIM_VERDICT_TEXT[result.verdict]} (Truth Score ${result.truthScore}/100).`];

  const modelLines = result.modelReads
    .filter((r) => r.ok && r.rationale)
    .map((r) => `${r.role === 'parser' ? 'Model A' : 'Model B'}: ${r.rationale}`);
  if (modelLines.length > 0) {
    parts.push(modelLines.join('\n'));
  }

  const evidenceLines = result.evidence.slice(0, 2).map((e) => `- "${e.title}" (${e.source})`);
  if (evidenceLines.length > 0) {
    parts.push(`Sources:\n${evidenceLines.join('\n')}`);
  }

  if (result.onChain) {
    parts.push(`Recorded on-chain: ${result.onChain.txDigest.slice(0, 10)}...`);
  }

  parts.push('This is an AI safety check, not a guarantee - verify important claims yourself.');
  return parts.join('\n\n');
}

/**
 * Turns one IntentReview into a guided conversation: the plan, then every safety
 * flag presented one at a time (each needs an explicit answer), then a recipient
 * save prompt. Calls `onResolved` exactly once, with the name to save (or '' to
 * skip saving) - the parent renders the actual Confirm & Send action.
 */
export function IntentChat({
  review,
  onResolved,
  onCancelled,
}: {
  review: IntentReview;
  onResolved: (saveName: string) => void;
  onCancelled: () => void;
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [flagQueue, setFlagQueue] = useState<SafetyFlag[]>([]);
  const [claimQueue, setClaimQueue] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending>(null);
  const [nameDraft, setNameDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const say = (text: string, tone?: Bubble['tone']) =>
    setBubbles((prev) => [...prev, { id: nextId(), from: 'system', text, tone }]);
  const reply = (text: string) => setBubbles((prev) => [...prev, { id: nextId(), from: 'user', text }]);

  const askNextFlag = (queue: SafetyFlag[]) => {
    const [next, ...rest] = queue;
    setFlagQueue(rest);
    say(next.detail, next.severity === 'warn' ? 'warn' : 'default');
    setPending({ kind: 'flag', flag: next });
  };

  const runClaimCheck = async (claim: string) => {
    setPending({ kind: 'claim-check', claim, result: null, loading: true });
    say(`Checking a claim you mentioned: "${claim}"...`);
    try {
      const result = await checkClaim(claim);
      say(claimResultLine(result), claimTone(result.verdict));
      setPending({ kind: 'claim-check', claim, result, loading: false });
    } catch {
      say(
        'Could not run a fact-check on that right now - the fact-check service may be unavailable. Confirm this yourself before relying on it.',
      );
      setPending({ kind: 'claim-check', claim, result: null, loading: false });
    }
  };

  const startClaimChecks = (queue: string[]) => {
    const [next, ...rest] = queue;
    if (!next) {
      goToSaveOrDone();
      return;
    }
    setClaimQueue(rest);
    runClaimCheck(next);
  };

  const goToSaveOrDone = () => {
    const plan = review.plan;
    if (!plan || plan.recipientKnown) {
      onResolved('');
      return;
    }
    if (plan.recipientNameFromMessage) {
      say(`Want me to save this recipient as "${plan.recipientName}" for next time?`);
      setPending({ kind: 'save-yesno' });
    } else {
      say('This address is not in your recipient book. Save it for next time?');
      setPending({ kind: 'save-yesno' });
    }
  };

  // Build the conversation once per new review.
  useEffect(() => {
    bubbleId = 0;
    setBubbles([]);
    setPending(null);
    setNameDraft('');
    setClaimQueue([]);

    if (review.status === 'cannot_execute') {
      setBubbles(
        review.flags.length > 0
          ? review.flags.map((f) => ({ id: nextId(), from: 'system', text: f.detail, tone: 'warn' }))
          : [{ id: nextId(), from: 'system', text: "I couldn't turn that into a transfer." }],
      );
      return;
    }

    const initial: Bubble[] = [{ id: nextId(), from: 'system', text: summaryLine(review.plan!) }];
    const reads = modelReadsLine(review);
    if (reads) {
      initial.push({ id: nextId(), from: 'system', text: reads });
    }
    setBubbles(initial);

    if (review.flags.length > 0) {
      const [first, ...rest] = review.flags;
      setFlagQueue(rest);
      setBubbles((prev) => [
        ...prev,
        { id: nextId(), from: 'system', text: first.detail, tone: first.severity === 'warn' ? 'warn' : 'default' },
      ]);
      setPending({ kind: 'flag', flag: first });
    } else {
      say('No concerns from either model.', 'good');
      startClaimChecks(review.claims);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review]);

  const answerFlag = (proceed: boolean) => {
    reply(proceed ? 'Continue' : 'Cancel');
    if (!proceed) {
      say('Transfer cancelled. Nothing was sent.');
      setPending(null);
      onCancelled();
      return;
    }
    if (flagQueue.length > 0) {
      askNextFlag(flagQueue);
    } else {
      startClaimChecks(review.claims);
    }
  };

  const answerClaim = (proceed: boolean) => {
    reply(proceed ? 'Continue' : 'Cancel');
    if (!proceed) {
      say('Transfer cancelled. Nothing was sent.');
      setPending(null);
      onCancelled();
      return;
    }
    startClaimChecks(claimQueue);
  };

  const answerSaveYesNo = (yes: boolean) => {
    reply(yes ? 'Yes' : 'No');
    if (!yes) {
      onResolved('');
      return;
    }
    const plan = review.plan!;
    if (plan.recipientNameFromMessage) {
      say(`Saved as "${plan.recipientName}".`, 'good');
      onResolved(plan.recipientName);
      return;
    }
    say('What would you like to call them?');
    setPending({ kind: 'save-name' });
  };

  const submitName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      return;
    }
    reply(trimmed);
    say(`Saved as "${trimmed}".`, 'good');
    setPending(null);
    onResolved(trimmed);
  };

  return (
    <View className="gap-3">
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        className="max-h-[420px] rounded-2xl border border-slate-800 bg-slate-900/40"
        contentContainerStyle={{ padding: 14, gap: 10 }}
      >
        {bubbles.map((b) => (
          <ChatBubble key={b.id} bubble={b} />
        ))}

        {pending?.kind === 'flag' ? (
          <ChoiceRow>
            <Choice label="Continue" tone="primary" onPress={() => answerFlag(true)} />
            <Choice label="Cancel" tone="outline" onPress={() => answerFlag(false)} />
          </ChoiceRow>
        ) : null}

        {pending?.kind === 'claim-check' && pending.loading ? (
          <View className="flex-row items-center gap-2 self-start rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5">
            <ActivityIndicator size="small" color="#94a3b8" />
            <Text className="text-sm text-slate-400">Fact-checking...</Text>
          </View>
        ) : null}

        {pending?.kind === 'claim-check' && !pending.loading ? (
          <ChoiceRow>
            <Choice label="Continue" tone="primary" onPress={() => answerClaim(true)} />
            <Choice label="Cancel" tone="outline" onPress={() => answerClaim(false)} />
          </ChoiceRow>
        ) : null}

        {pending?.kind === 'save-yesno' ? (
          <ChoiceRow>
            <Choice label="Yes, save" tone="primary" onPress={() => answerSaveYesNo(true)} />
            <Choice label="No thanks" tone="outline" onPress={() => answerSaveYesNo(false)} />
          </ChoiceRow>
        ) : null}

        {pending?.kind === 'save-name' ? (
          <View className="gap-2">
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
              <Choice label="Skip" tone="outline" onPress={() => onResolved('')} />
            </ChoiceRow>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ChatBubble({ bubble }: { bubble: Bubble }) {
  if (bubble.from === 'user') {
    return (
      <View className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5">
        <Text className="text-sm font-medium text-white">{bubble.text}</Text>
      </View>
    );
  }

  const toneClass =
    bubble.tone === 'warn'
      ? 'border-amber-400/30 bg-amber-400/10'
      : bubble.tone === 'good'
        ? 'border-emerald-400/30 bg-emerald-400/10'
        : 'border-slate-800 bg-slate-900';

  return (
    <View className={`max-w-[90%] flex-row items-start gap-2 self-start rounded-2xl rounded-bl-sm border px-4 py-2.5 ${toneClass}`}>
      <Ionicons
        name={bubble.tone === 'warn' ? 'alert-circle' : bubble.tone === 'good' ? 'checkmark-circle' : 'sparkles'}
        size={15}
        color={bubble.tone === 'warn' ? '#fbbf24' : bubble.tone === 'good' ? '#34d399' : '#60a5fa'}
        style={{ marginTop: 2 }}
      />
      <Text className="flex-1 text-sm leading-5 text-slate-200">{bubble.text}</Text>
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
      <Text className={`text-sm font-semibold ${tone === 'primary' ? 'text-white' : 'text-slate-300'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChatLoading() {
  return (
    <View className="flex-row items-center gap-2 self-start rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5">
      <ActivityIndicator size="small" color="#94a3b8" />
      <Text className="text-sm text-slate-400">Sending...</Text>
    </View>
  );
}
