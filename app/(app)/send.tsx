import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { type CoinMeta, SUI_COIN, SUPPORTED_COINS, toBaseUnits, USDC_COIN } from '@/lib/sui/coins';
import { explorerTxUrl } from '@/lib/sui/network';
import { executeTransfer, type TransferOutcome } from '@/lib/sui/transfer';

type Phase = 'form' | 'submitting' | 'done';

export default function SendScreen() {
  const router = useRouter();
  const { getSigner } = useAuth();

  const [coin, setCoin] = useState<CoinMeta>(USDC_COIN);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<TransferOutcome | null>(null);

  const canSubmit = useMemo(
    () => recipient.trim().length > 0 && amount.trim().length > 0 && phase === 'form',
    [recipient, amount, phase],
  );

  const onSubmit = useCallback(async () => {
    setError(null);
    let amountBaseUnits: bigint;
    try {
      amountBaseUnits = toBaseUnits(amount, coin.decimals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid amount.');
      return;
    }

    setPhase('submitting');
    try {
      const signer = await getSigner();
      const result = await executeTransfer(signer, {
        recipient: recipient.trim(),
        amountBaseUnits,
        coinType: coin.type,
      });
      setOutcome(result);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The transfer failed.');
      setPhase('form');
    }
  }, [amount, coin, getSigner, recipient]);

  if (phase === 'done' && outcome) {
    const ok = outcome.status === 'success';
    return (
      <ScrollView className="flex-1 bg-white" contentContainerClassName="gap-6 px-6 py-10">
        <Stack.Screen options={{ title: 'Send', headerShown: true }} />

        <Text className={`text-2xl font-bold ${ok ? 'text-emerald-700' : 'text-red-600'}`}>
          {ok ? 'Transfer settled' : 'Transfer failed on chain'}
        </Text>

        {ok ? (
          <Text className="text-base leading-6 text-slate-600">
            {amount} {coin.symbol} sent to{'\n'}
            <Text className="font-mono text-sm">{recipient.trim()}</Text>
          </Text>
        ) : (
          <Text className="text-base leading-6 text-red-600">{outcome.error ?? 'Unknown error.'}</Text>
        )}

        <View className="gap-2 rounded-2xl border border-slate-200 p-5">
          <Text className="text-sm text-slate-500">Transaction digest</Text>
          <Text className="font-mono text-xs text-slate-900" selectable>
            {outcome.digest}
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              void Linking.openURL(explorerTxUrl(outcome.digest));
            }}
          >
            <Text className="text-sm font-semibold text-emerald-700">View on explorer</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="items-center rounded-xl bg-emerald-700 px-5 py-4 active:bg-emerald-800"
        >
          <Text className="text-base font-bold text-white">Back to Home</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="gap-6 px-6 py-10"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Send', headerShown: true }} />

      <View className="flex-row gap-2">
        {SUPPORTED_COINS.map((option) => {
          const active = option.type === coin.type;
          return (
            <Pressable
              key={option.type}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setCoin(option)}
              className={`flex-1 items-center rounded-xl border px-4 py-3 ${
                active ? 'border-emerald-700 bg-emerald-50' : 'border-slate-300'
              }`}
            >
              <Text className={`font-semibold ${active ? 'text-emerald-800' : 'text-slate-700'}`}>
                {option.symbol}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-slate-700">Recipient Sui address</Text>
        <TextInput
          value={recipient}
          onChangeText={setRecipient}
          placeholder="0x..."
          autoCapitalize="none"
          autoCorrect={false}
          editable={phase === 'form'}
          className="rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm text-slate-900"
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setRecipient(Ed25519Keypair.generate().toSuiAddress())}
        >
          <Text className="text-xs font-semibold text-emerald-700">Fill a throwaway test address</Text>
        </Pressable>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-slate-700">Amount ({coin.symbol})</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
          editable={phase === 'form'}
          className="rounded-xl border border-slate-300 px-4 py-3 text-lg text-slate-900"
        />
      </View>

      {coin.type === SUI_COIN.type ? (
        <Text className="text-xs leading-5 text-slate-400">
          Sending SUI also spends a little SUI on gas.
        </Text>
      ) : null}

      {error ? (
        <Text className="text-sm leading-5 text-red-600" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Send ${coin.symbol}`}
        disabled={!canSubmit}
        onPress={onSubmit}
        className="flex-row items-center justify-center gap-3 rounded-xl bg-emerald-700 px-5 py-4 active:bg-emerald-800 disabled:opacity-50"
      >
        {phase === 'submitting' ? <ActivityIndicator color="#ffffff" /> : null}
        <Text className="text-base font-bold text-white">
          {phase === 'submitting' ? 'Submitting...' : 'Send'}
        </Text>
      </Pressable>

      <Text className="text-xs leading-5 text-slate-400">
        This build signs and submits directly from the app. Backend confirmation, sponsorship, and
        the AI safety review come in later phases.
      </Text>
    </ScrollView>
  );
}
