import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { checkClaim } from '@/lib/intent/client';
import type { ClaimCheckResult, ClaimModelRead } from '@/shared/contracts';

import { ReasoningTrace, type TraceStep } from './reasoning-trace';

/** The pipeline really does run in this order server-side (see
 * server/src/factcheck/check-claim.ts: evidence retrieval, then the model
 * calls, then a deterministic verdict) but arrives as one HTTP response with
 * no incremental signal. These timings are an honest best-guess promotion of
 * what should be happening when; the real result always overrides them the
 * moment it actually arrives, so a stage is never shown done before it is. */
const IDLE_TRACE: TraceStep[] = [
  { id: 'search', label: 'Searching real news coverage', sublabel: 'NewsAPI - never a model\'s own memory', status: 'pending' },
  { id: 'models', label: 'Cross-verifying with two independent models', sublabel: 'Gonka Router - reasoning only over what NewsAPI returned', status: 'pending' },
  { id: 'verdict', label: 'Combining into a verdict', sublabel: 'Deterministic code, not another model call', status: 'pending' },
];

const VERDICT_STYLE: Record<ClaimCheckResult['verdict'], { label: string; color: string; bg: string; border: string }> = {
  SUPPORTED: { label: 'Supported', color: '#34d399', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  CONTRADICTED: { label: 'Contradicted', color: '#f87171', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  DISPUTED: { label: 'Disputed', color: '#fbbf24', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  UNVERIFIABLE: { label: 'Unverifiable', color: '#94a3b8', bg: 'bg-slate-700/30', border: 'border-slate-600/40' },
};

const ROLE_LABEL: Record<ClaimModelRead['role'], string> = { parser: 'Model A', verifier: 'Model B' };

/**
 * Standalone claim verification: paste any claim, URL, or text snippet and get
 * a full transparency report - not tied to composing a payment. Reuses the
 * exact same `/v1/intent/check-claim` pipeline the Send flow's inline fact-check
 * uses (real NewsAPI evidence, two independent Gonka models reasoning only over
 * that evidence, a deterministic verdict), just with nothing condensed: every
 * model's full rationale, every Gonka Request ID, every source.
 *
 * Note on scope: pasting a URL or tweet does not fetch its page/content - the
 * pasted text itself is the claim sent to evidence search and to the models.
 * That's a deliberate, honest limit, not an oversight.
 */
export function FactCheckSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimCheckResult | null>(null);
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>(IDLE_TRACE);

  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setInput('');
      setLoading(false);
      setError(null);
      setResult(null);
      setTraceSteps(IDLE_TRACE);
    }
  }

  const submit = async () => {
    const claim = input.trim();
    if (!claim) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setTraceSteps((steps) => steps.map((s) => (s.id === 'search' ? { ...s, status: 'active' } : s)));
    const promoteToModels = setTimeout(() => {
      setTraceSteps((steps) => steps.map((s) => (s.id === 'search' ? { ...s, status: 'done' } : s.id === 'models' ? { ...s, status: 'active' } : s)));
    }, 1000);
    const promoteToVerdict = setTimeout(() => {
      setTraceSteps((steps) => steps.map((s) => (s.id === 'models' ? { ...s, status: 'done' } : s.id === 'verdict' ? { ...s, status: 'active' } : s)));
    }, 2400);
    try {
      const raw = await checkClaim(claim);
      // Defensive: never trust a network response's shape blindly - see the
      // matching guard in send-chat.tsx's settleReview for why.
      const claimResult: ClaimCheckResult = {
        ...raw,
        evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
        modelReads: Array.isArray(raw.modelReads) ? raw.modelReads : [],
      };
      setTraceSteps((steps) => steps.map((s) => ({ ...s, status: 'done' })));
      setResult(claimResult);
    } catch (err) {
      setTraceSteps((steps) => steps.map((s) => (s.status === 'done' ? s : { ...s, status: 'error' })));
      setError(err instanceof Error ? err.message : 'Could not check this claim - the fact-check service may be unavailable.');
    } finally {
      clearTimeout(promoteToModels);
      clearTimeout(promoteToVerdict);
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="max-h-[88%] rounded-t-3xl border-t border-slate-800 bg-slate-950 p-5 pb-8">
            <View className="mb-1 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="shield-checkmark-outline" size={19} color="#60a5fa" />
                <Text className="text-lg font-bold text-white">AI Fact Checker</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={onClose} className="rounded-full p-1 active:bg-slate-800">
                <Ionicons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>
            <Text className="mb-4 text-xs leading-4 text-slate-500">
              Paste a claim, headline, URL, or tweet text. Two independent models cross-verify it against real retrieved
              news evidence - never their own memory.
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
              <View className="gap-2">
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder='e.g. "There is a hurricane in the Philippines right now"'
                  placeholderTextColor="#475569"
                  multiline
                  editable={!loading}
                  className="min-h-[80px] rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm leading-5 text-slate-100"
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={loading || input.trim().length < 3}
                  onPress={() => void submit()}
                  className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 active:bg-blue-500 disabled:opacity-40"
                >
                  {loading ? <ActivityIndicator color="#ffffff" size="small" /> : null}
                  <Text className="text-sm font-bold text-white">{loading ? 'Checking against real news...' : 'Check this claim'}</Text>
                </Pressable>
              </View>

              {loading ? <ReasoningTrace title="AI Fact Checker" steps={traceSteps} /> : null}

              {error ? (
                <View className="flex-row items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 p-3">
                  <Ionicons name="alert-circle" size={15} color="#f87171" style={{ marginTop: 1 }} />
                  <Text className="flex-1 text-xs leading-5 text-red-300">{error}</Text>
                </View>
              ) : null}

              {result ? <FactCheckReport result={result} /> : null}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FactCheckReport({ result }: { result: ClaimCheckResult }) {
  const style = VERDICT_STYLE[result.verdict];
  return (
    <View className={`gap-4 rounded-2xl border p-4 ${style.bg} ${style.border}`}>
      {/* Truth Score + verdict */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: style.color }} />
          <Text className="text-base font-bold" style={{ color: style.color }}>
            {style.label}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Truth Score</Text>
          <Text className="text-2xl font-bold text-white">{result.truthScore}/100</Text>
        </View>
      </View>

      <Text className="text-xs leading-5 text-slate-400">&quot;{result.claim}&quot;</Text>

      {/* Evidence */}
      <View className="gap-2 border-t border-slate-800 pt-3">
        <Text className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Evidence retrieved ({result.evidence.length})
        </Text>
        {result.evidence.length === 0 ? (
          <Text className="text-xs text-slate-500">No real news coverage was found for this claim.</Text>
        ) : (
          result.evidence.map((e, i) => (
            <Pressable key={i} onPress={() => void Linking.openURL(e.url)} className="gap-0.5 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
              <Text className="text-xs font-semibold text-blue-300" numberOfLines={2}>
                {e.title}
              </Text>
              <Text className="text-[11px] text-slate-500">
                {e.source}
                {e.publishedAt ? ` - ${new Date(e.publishedAt).toLocaleDateString()}` : ''}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {/* Reasoning trace - full, per model, with Gonka Request IDs */}
      <View className="gap-3 border-t border-slate-800 pt-3">
        <Text className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Reasoning trace - Gonka Router (gonkarouter.io)
        </Text>
        {result.modelReads.length === 0 ? (
          <Text className="text-xs text-slate-500">No evidence was retrieved, so no model was consulted - an unsupported claim is reported as-is, never guessed at.</Text>
        ) : (
          result.modelReads.map((read, i) => <ModelReadCard key={i} read={read} />)
        )}
      </View>

      {result.onChain ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(result.onChain!.explorerUrl)}
          className="flex-row items-center gap-2 rounded-lg border border-blue-400/20 bg-blue-400/10 p-2.5"
        >
          <Ionicons name="link" size={13} color="#60a5fa" />
          <Text className="flex-1 text-[11px] leading-4 text-blue-300">
            Recorded on-chain (Sui {result.onChain.network}): {result.onChain.txDigest.slice(0, 14)}...
          </Text>
        </Pressable>
      ) : null}

      <Text className="text-[11px] leading-4 text-slate-500">
        This is an AI safety check, not a guarantee - verify important claims yourself.
      </Text>
    </View>
  );
}

function ModelReadCard({ read }: { read: ClaimModelRead }) {
  const stanceColor = read.stance === 'supports' ? '#34d399' : read.stance === 'contradicts' ? '#f87171' : '#94a3b8';
  return (
    <View className="gap-1.5 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold text-slate-200">
          {ROLE_LABEL[read.role]} <Text className="font-normal text-slate-500">({read.model})</Text>
        </Text>
        {read.ok && read.stance ? (
          <Text className="text-[10px] font-bold uppercase" style={{ color: stanceColor }}>
            {read.stance}
          </Text>
        ) : null}
      </View>
      {read.ok ? (
        <Text className="text-xs leading-5 text-slate-400">{read.rationale}</Text>
      ) : (
        <Text className="text-xs leading-5 text-red-400">Call failed: {read.error}</Text>
      )}
      <Text className="font-mono text-[10px] text-slate-600" selectable>
        Gonka Request ID: {read.requestId ?? 'unavailable'}
      </Text>
    </View>
  );
}
