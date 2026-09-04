import { Ionicons } from '@expo/vector-icons';
import { isValidSuiAddress } from '@mysten/sui/utils';
import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';

import { IntentReviewCard } from '@/components/intent-review';
import { Screen } from '@/components/screen';
import { useAuth } from '@/lib/auth/auth-context';
import {
  assessManualPlan,
  confirmAndExecute,
  parseMessage,
  type TransferOutcome,
} from '@/lib/intent/client';
import { type Recipient, useRecipients } from '@/lib/recipients/use-recipients';
import { SUPPORTED_COINS, toBaseUnits, USDC_COIN } from '@/lib/sui/coins';
import { apiPost } from '@/lib/sui/api';
import { explorerTxUrl } from '@/lib/sui/network';
import { saveSettledTransaction } from '@/lib/transactions/ledger';
import type { IntentReview, ResolvedPlan, TransferAsset } from '@/shared/contracts';

type Mode = 'describe' | 'manual';
type Phase = 'compose' | 'checking' | 'review' | 'submitting' | 'done';

const EXAMPLES = [
  'Send Mum 100 USDC for groceries',
  'Send Dad 50 USDC every month for his phone bill',
  'This month send Mum an extra 30 USDC for school fees',
];

export default function SendScreen() {
  const { session, getSigner } = useAuth();
  const { recipients } = useRecipients();
  const params = useLocalSearchParams<{ mode?: string }>();

  const [mode, setMode] = useState<Mode>(params.mode === 'manual' ? 'manual' : 'describe');
  const [phase, setPhase] = useState<Phase>('compose');
  const [error, setError] = useState<string | null>(null);

  const [message, setMessage] = useState('');

  const [picked, setPicked] = useState<Recipient | null>(null);
  const [otherAddress, setOtherAddress] = useState('');
  const [asset, setAsset] = useState<TransferAsset>('USDC');
  const [amount, setAmount] = useState('');

  const [review, setReview] = useState<IntentReview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [outcome, setOutcome] = useState<TransferOutcome | null>(null);

  const owner = session?.walletAddress ?? '';

  const reset = useCallback(() => {
    setPhase('compose');
    setError(null);
    setReview(null);
    setAcknowledged(false);
    setSaveName('');
    setOutcome(null);
    setMessage('');
    setPicked(null);
    setOtherAddress('');
    setAmount('');
  }, []);

  const manualAddress = picked?.address ?? otherAddress.trim();
  const manualValid =
    (picked != null || isValidSuiAddress(otherAddress.trim())) &&
    Number(amount) > 0 &&
    phase === 'compose';

  const runReview = useCallback(async () => {
    setError(null);
    setPhase('checking');
    try {
      let result: IntentReview;
      if (mode === 'describe') {
        result = await parseMessage(owner, message.trim());
      } else {
        const plan: ResolvedPlan = {
          recipientName: picked?.name ?? shortAddress(manualAddress),
          recipientAddress: manualAddress,
          recipientKnown: picked != null,
          recipientNameFromMessage: false,
          amount: Number(amount),
          asset,
          frequency: 'ONE_TIME',
          monthlyDay: null,
          note: null,
        };
        result = await assessManualPlan(owner, plan);
      }
      setReview(result);
      // If the message named a new recipient, pre-fill the save field.
      setSaveName(result.plan?.recipientNameFromMessage ? result.plan.recipientName : '');
      setAcknowledged(false);
      setPhase('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run the safety check.');
      setPhase('compose');
    }
  }, [mode, owner, message, picked, manualAddress, amount, asset]);

  const send = useCallback(async () => {
    if (!review?.plan) {
      return;
    }
    setError(null);
    setPhase('submitting');
    try {
      const signer = await getSigner();
      const result = await confirmAndExecute(signer, review.plan);

      const nameToSave = saveName.trim();
      if (nameToSave && !review.plan.recipientKnown) {
        await apiPost('/v1/recipients', {
          owner,
          name: nameToSave,
          address: review.plan.recipientAddress,
        }).catch(() => undefined);
      }

      if (result.status === 'success') {
        // A local activity-record failure must never turn a settled on-chain payment into a UI failure.
        try {
          const coin = SUPPORTED_COINS.find((c) => c.symbol === review.plan?.asset) ?? USDC_COIN;
          await saveSettledTransaction({
            id: result.digest,
            digest: result.digest,
            recipient: review.plan.recipientAddress,
            amountBaseUnits: toBaseUnits(String(review.plan.amount), coin.decimals).toString(),
            coinType: coin.type,
            symbol: coin.symbol,
            decimals: coin.decimals,
            occurredAt: new Date().toISOString(),
            status: 'success',
          });
        } catch {
          // The on-chain receipt remains the source of truth on the result screen.
        }
      }

      setOutcome(result);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The transfer failed.');
      setPhase('review');
    }
  }, [review, getSigner, saveName, owner]);

  // --- done -----------------------------------------------------------------
  if (phase === 'done' && outcome) {
    const ok = outcome.status === 'success';
    return (
      <Screen gap={24}>
        <Ionicons
          name={ok ? 'checkmark-circle' : 'close-circle'}
          size={44}
          color={ok ? '#34d399' : '#f87171'}
        />
        <Text className={`text-3xl font-bold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {ok ? 'Transfer settled' : 'Transfer failed'}
        </Text>
        {!ok ? (
          <Text className="text-base leading-6 text-red-400">{outcome.error ?? 'Unknown error.'}</Text>
        ) : review?.plan ? (
          <Text className="text-base leading-6 text-slate-300">
            {review.plan.amount} {review.plan.asset} sent to {review.plan.recipientName}.
          </Text>
        ) : null}

        <View className="gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <Text className="text-sm text-slate-400">Transaction digest</Text>
          <Text className="font-mono text-xs text-slate-200" selectable>
            {outcome.digest}
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(explorerTxUrl(outcome.digest))}
          >
            <Text className="text-sm font-semibold text-emerald-400">View on explorer</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={reset}
          className="items-center rounded-xl bg-blue-600 px-5 py-4 active:bg-blue-500"
        >
          <Text className="text-base font-bold text-white">Send another</Text>
        </Pressable>
      </Screen>
    );
  }

  // --- review -------------------------------------------------------------
  if ((phase === 'review' || phase === 'submitting') && review) {
    const canExecute = review.status !== 'cannot_execute' && review.plan != null;
    const needsAck = review.status === 'needs_review';
    const offerSave =
      review.plan != null &&
      !review.plan.recipientKnown &&
      isValidSuiAddress(review.plan.recipientAddress);

    return (
      <Screen gap={20}>
        <Text className="text-2xl font-bold tracking-tight text-white">Review</Text>

        <IntentReviewCard review={review} />

        {error ? <Text className="text-sm leading-5 text-red-400">{error}</Text> : null}

        {offerSave ? (
          <View className="gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="bookmark-outline" size={14} color="#64748b" />
              <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {saveName.trim() ? 'Save as' : 'Save this recipient'}
              </Text>
            </View>
            <TextInput
              value={saveName}
              onChangeText={setSaveName}
              placeholder="Name (leave blank to skip)"
              placeholderTextColor="#475569"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
            {review.plan?.recipientNameFromMessage ? (
              <Text className="text-[11px] leading-4 text-slate-500">
                Name taken from your message. Edit or clear it to change what gets saved.
              </Text>
            ) : null}
          </View>
        ) : null}

        {needsAck ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acknowledged }}
            onPress={() => setAcknowledged((v) => !v)}
            className="flex-row items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4"
          >
            <Ionicons
              name={acknowledged ? 'checkbox' : 'square-outline'}
              size={20}
              color="#fbbf24"
            />
            <Text className="flex-1 text-sm leading-5 text-amber-200">
              I have read the warnings and want to send anyway.
            </Text>
          </Pressable>
        ) : null}

        <View className="gap-2">
          {canExecute ? (
            <Pressable
              accessibilityRole="button"
              disabled={phase === 'submitting' || (needsAck && !acknowledged)}
              onPress={send}
              className="flex-row items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-4 active:bg-blue-500 disabled:opacity-50"
            >
              {phase === 'submitting' ? <ActivityIndicator color="#ffffff" /> : null}
              <Text className="text-base font-bold text-white">
                {phase === 'submitting'
                  ? 'Sending...'
                  : needsAck
                    ? 'Send anyway'
                    : 'Confirm and send'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={phase === 'submitting'}
            onPress={() => {
              setPhase('compose');
              setError(null);
            }}
            className="items-center rounded-xl border border-slate-700 px-5 py-4 active:bg-slate-800 disabled:opacity-50"
          >
            <Text className="text-sm font-semibold text-slate-300">Edit</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // --- compose -----------------------------------------------------------
  return (
    <Screen gap={20} keyboardShouldPersistTaps="handled">
      <View className="gap-1">
        <Text className="text-3xl font-bold tracking-tight text-white">Send</Text>
        <Text className="text-sm leading-5 text-slate-400">
          Describe the payment in your own words, or enter it manually.
        </Text>
      </View>

      <View className="flex-row gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
        <ModeTab label="Describe it" active={mode === 'describe'} onPress={() => setMode('describe')} />
        <ModeTab label="Manual" active={mode === 'manual'} onPress={() => setMode('manual')} />
      </View>

      {error ? <Text className="text-sm leading-5 text-red-400">{error}</Text> : null}

      {mode === 'describe' ? (
        <>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="e.g. Send Mum 150 USDC this month for school fees"
            placeholderTextColor="#475569"
            multiline
            editable={phase === 'compose'}
            className="min-h-[96px] rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-base leading-6 text-slate-100"
          />
          <View className="gap-2">
            <Text className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Examples
            </Text>
            {EXAMPLES.map((ex) => (
              <Pressable key={ex} onPress={() => setMessage(ex)} className="active:opacity-60">
                <Text className="text-xs leading-5 text-blue-400">{ex}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <View className="gap-2">
            <Text className="text-sm font-medium text-slate-300">Recipient</Text>
            {recipients.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {recipients.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      setPicked((cur) => (cur?.id === r.id ? null : r));
                      setOtherAddress('');
                    }}
                    className={`rounded-xl border px-3 py-2 ${
                      picked?.id === r.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 bg-slate-900/60'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${picked?.id === r.id ? 'text-blue-300' : 'text-slate-300'}`}
                    >
                      {r.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Link href="/(app)/recipients" asChild>
                <Pressable>
                  <Text className="text-xs text-blue-400">No saved recipients yet - add one</Text>
                </Pressable>
              </Link>
            )}
            <TextInput
              value={picked ? '' : otherAddress}
              onChangeText={(t) => {
                setOtherAddress(t);
                setPicked(null);
              }}
              placeholder="or paste a 0x address"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
              editable={phase === 'compose' && !picked}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs text-slate-100"
            />
          </View>

          <View className="flex-row gap-2">
            {(['USDC', 'SUI'] as TransferAsset[]).map((a) => (
              <Pressable
                key={a}
                onPress={() => setAsset(a)}
                className={`flex-1 items-center rounded-xl border px-4 py-3 ${
                  asset === a ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-900/60'
                }`}
              >
                <Text className={`font-semibold ${asset === a ? 'text-blue-300' : 'text-slate-300'}`}>
                  {a}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="gap-2">
            <Text className="text-sm font-medium text-slate-300">Amount ({asset})</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#475569"
              keyboardType="decimal-pad"
              editable={phase === 'compose'}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-lg text-slate-100"
            />
          </View>
        </>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={
          phase === 'checking' ||
          (mode === 'describe' ? message.trim().length < 3 : !manualValid)
        }
        onPress={runReview}
        className="flex-row items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-4 active:bg-blue-500 disabled:opacity-50"
      >
        {phase === 'checking' ? <ActivityIndicator color="#ffffff" /> : null}
        <Text className="text-base font-bold text-white">
          {phase === 'checking'
            ? mode === 'describe'
              ? 'Two models checking...'
              : 'Checking...'
            : 'Review'}
        </Text>
      </Pressable>

      {phase === 'checking' && mode === 'describe' ? (
        <Text className="text-center text-xs leading-5 text-slate-500">
          A parser and an independent verifier are reading your message. This can take up to a
          minute.
        </Text>
      ) : null}
    </Screen>
  );
}

function ModeTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-1 items-center rounded-lg px-3 py-2 ${active ? 'bg-blue-600' : ''}`}
    >
      <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-400'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}
