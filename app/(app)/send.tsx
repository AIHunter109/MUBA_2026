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
      <ScrollView className="flex-1 bg-slate-950" contentContainerClassName="gap-6 px-5 py-8">
        <Stack.Screen
          options={{
            title: 'Send',
            headerShown: true,
            headerStyle: { backgroundColor: '#020617' },
            headerTintColor: '#f8fafc',
            headerTitleStyle: { color: '#f8fafc' },
          }}
        />

        <Text className={`text-3xl font-bold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {ok ? 'Transfer settled' : 'Transfer failed on chain'}
        </Text>

        {ok ? (
          <Text className="text-base leading-6 text-slate-300">
            {amount} {coin.symbol} sent to{'\n'}
            <Text className="font-mono text-sm">{recipient.trim()}</Text>
          </Text>
        ) : (
          <Text className="text-base leading-6 text-red-400">{outcome.error ?? 'Unknown error.'}</Text>
        )}

        <View className="gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <Text className="text-sm text-slate-400">Transaction digest</Text>
          <Text className="font-mono text-xs text-slate-200" selectable>
            {outcome.digest}
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              void Linking.openURL(explorerTxUrl(outcome.digest));
            }}
          >
            <Text className="text-sm font-semibold text-emerald-400">View on explorer</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
          className="items-center rounded-xl bg-blue-600 px-5 py-4 active:bg-blue-500"
        >
          <Text className="text-base font-bold text-white">Back to Home</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-950"
      contentContainerClassName="gap-6 px-5 py-8"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          title: 'Send',
          headerShown: true,
          headerStyle: { backgroundColor: '#020617' },
          headerTintColor: '#f8fafc',
          headerTitleStyle: { color: '#f8fafc' },
        }}
      />

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
                active ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-900/60'
              }`}
            >
              <Text className={`font-semibold ${active ? 'text-blue-300' : 'text-slate-300'}`}>
                {option.symbol}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-slate-300">Recipient Sui address</Text>
        <TextInput
          value={recipient}
          onChangeText={setRecipient}
          placeholder="0x..."
          autoCapitalize="none"
          autoCorrect={false}
          editable={phase === 'form'}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100"
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setRecipient(Ed25519Keypair.generate().toSuiAddress())}
        >
          <Text className="text-xs font-semibold text-blue-400">Fill a throwaway test address</Text>
        </Pressable>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-slate-300">Amount ({coin.symbol})</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
          editable={phase === 'form'}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-lg text-slate-100"
        />
      </View>

      {coin.type === SUI_COIN.type ? (
        <Text className="text-xs leading-5 text-slate-500">
          Sending SUI also spends a little SUI on gas.
        </Text>
      ) : null}

      {error ? (
        <Text className="text-sm leading-5 text-red-400" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Send ${coin.symbol}`}
        disabled={!canSubmit}
        onPress={onSubmit}
        className="flex-row items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-4 active:bg-blue-500 disabled:opacity-50"
      >
        {phase === 'submitting' ? <ActivityIndicator color="#ffffff" /> : null}
        <Text className="text-base font-bold text-white">
          {phase === 'submitting' ? 'Submitting...' : 'Send'}
        </Text>
      </Pressable>

      <Text className="text-xs leading-5 text-slate-500">
        This build signs and submits directly from the app. Backend confirmation, sponsorship, and
        the AI safety review come in later phases.
      </Text>
    </ScrollView>
  );
}
