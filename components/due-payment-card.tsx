import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/translated-text';

export type DueRecurringRule = {
  id: string;
  recipientName: string;
  recipientAddress: string;
  amount: string;
  asset: 'USDC' | 'SUI';
  frequency: string;
  nextTriggerAt: string;
  /** 'needs_reconciliation' - a manual transfer to this recipient already
   * happened this window (a deterministic log match, not AI-guessed) - offer
   * send-anyway/skip instead of treating this as a plain due payment. */
  status: 'due' | 'needs_reconciliation';
  matchedManualTransferAt?: string;
};

/**
 * The "check on open, don't auto-fire" reminder: shown on the dashboard for
 * every recurring rule whose date has arrived. Nothing here executes without
 * this explicit tap - the recurring rule itself was the one-time setup
 * confirmation; this is the per-cycle "does this still look right" check.
 */
export function DuePaymentCard({
  rule,
  onSend,
  onSkip,
}: {
  rule: DueRecurringRule;
  onSend: (rule: DueRecurringRule, amount: string) => Promise<void>;
  onSkip: (rule: DueRecurringRule) => Promise<void>;
}) {
  const [amount, setAmount] = useState(rule.amount);
  const [busy, setBusy] = useState<'send' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsReconciliation = rule.status === 'needs_reconciliation';

  const send = async () => {
    setBusy('send');
    setError(null);
    try {
      await onSend(rule, amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send this payment.');
      setBusy(null);
    }
  };

  const skip = async () => {
    setBusy('skip');
    setError(null);
    try {
      await onSkip(rule);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not skip this payment.');
      setBusy(null);
    }
  };

  return (
    <View
      className={`gap-3 rounded-2xl border p-4 ${
        needsReconciliation ? 'border-amber-400/30 bg-amber-400/5' : 'border-blue-400/30 bg-blue-400/5'
      }`}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons
          name={needsReconciliation ? 'alert-circle' : 'calendar'}
          size={18}
          color={needsReconciliation ? '#fbbf24' : '#60a5fa'}
        />
        <Text className={`text-sm font-bold ${needsReconciliation ? 'text-amber-300' : 'text-blue-300'}`}>
          {needsReconciliation ? 'Already sent manually?' : 'Payment due'}
        </Text>
      </View>

      <Text className="text-sm leading-5 text-slate-300">
        {needsReconciliation
          ? `You already sent ${rule.recipientName} a manual transfer since this recurring payment last ran. Send this cycle's amount anyway, or skip it?`
          : `${rule.recipientName} is due for ${rule.amount} ${rule.asset} (${rule.frequency.toLowerCase()}).`}
      </Text>

      <View className="gap-1">
        <Text className="text-xs text-slate-500">Amount ({rule.asset})</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholderTextColor="#475569"
          editable={busy === null}
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        />
      </View>

      {error ? <Text className="text-xs text-red-400">{error}</Text> : null}

      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          disabled={busy !== null || Number(amount) <= 0}
          onPress={() => void send()}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 active:bg-blue-500 disabled:opacity-50"
        >
          {busy === 'send' ? <ActivityIndicator color="#ffffff" size="small" /> : null}
          <Text className="text-sm font-bold text-white">{busy === 'send' ? 'Sending...' : 'Send now'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy !== null}
          onPress={() => void skip()}
          className="items-center justify-center rounded-xl border border-slate-700 px-4 py-3 active:bg-slate-800 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-slate-300">
            {busy === 'skip' ? 'Skipping...' : 'Skip this month'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
