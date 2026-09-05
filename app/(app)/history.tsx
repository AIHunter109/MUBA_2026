import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, View } from 'react-native';
import { Text } from '@/components/translated-text';

import { Screen } from '@/components/screen';
import { useAuth } from '@/lib/auth/auth-context';
import { apiGet } from '@/lib/sui/api';
import { fromBaseUnits, SUPPORTED_COINS, toBaseUnits, USDC_COIN } from '@/lib/sui/coins';
import { explorerTxUrl } from '@/lib/sui/network';
import { getTransactionLedger, type TransactionRecord } from '@/lib/transactions/ledger';
import { useI18n } from '@/lib/i18n/i18n-context';

type StoredTransaction = {
  digest: string;
  recipient: string;
  recipientName?: string;
  amount: string;
  asset: 'USDC' | 'SUI';
  occurredAt: string;
  direction: 'SENT' | 'RECEIVED';
};

async function loadTransactions(owner: string): Promise<TransactionRecord[]> {
  const local = await getTransactionLedger();
  const remote = await apiGet<{ transactions: StoredTransaction[] }>(
    `/v1/transactions?owner=${encodeURIComponent(owner)}`,
  )
    .then(({ transactions }) =>
      transactions.map((transaction) => {
        const coin = SUPPORTED_COINS.find((item) => item.symbol === transaction.asset) ?? USDC_COIN;
        return {
          id: transaction.digest,
          digest: transaction.digest,
          recipient: transaction.recipient,
          recipientName: transaction.recipientName,
          amountBaseUnits: toBaseUnits(transaction.amount, coin.decimals).toString(),
          coinType: coin.type,
          symbol: coin.symbol,
          decimals: coin.decimals,
          occurredAt: transaction.occurredAt,
          status: 'success' as const,
          direction: transaction.direction,
        };
      }),
    )
    .catch(() => []);

  const byDigest = new Map<string, TransactionRecord>();
  for (const item of [...local, ...remote]) byDigest.set(item.digest, item);
  return [...byDigest.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export default function HistoryScreen() {
  const { session } = useAuth();
  const { t, language } = useI18n();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!session?.walletAddress) return;
    setRefreshing(true);
    try {
      setTransactions(await loadTransactions(session.walletAddress));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.walletAddress]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#94a3b8" />}>
      <View className="gap-1">
        <Text className="text-3xl font-bold tracking-tight text-white">{t('transactionHistory')}</Text>
        <Text className="text-sm leading-5 text-slate-400">{t('historySubtitle')}</Text>
      </View>
      {loading ? <ActivityIndicator color="#94a3b8" /> : null}
      {!loading && transactions.length === 0 ? (
        <View className="items-center gap-2 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-5 py-8">
          <Ionicons name="receipt-outline" size={28} color="#64748b" />
          <Text className="text-sm font-semibold text-slate-300">No recorded transactions yet</Text>
          <Text className="text-center text-xs leading-5 text-slate-500">Completed transfers from this wallet will appear here automatically.</Text>
        </View>
      ) : null}
      <View className="gap-3">
        {transactions.map((transaction) => <HistoryRow key={transaction.digest} transaction={transaction} t={t} language={language} />)}
      </View>
    </Screen>
  );
}

function HistoryRow({ transaction, t, language }: { transaction: TransactionRecord; t: (key: string, values?: Record<string, string>) => string; language: string }) {
  const date = new Date(transaction.occurredAt);
  const received = transaction.direction === 'RECEIVED';
  const counterparty = transaction.recipientName ?? (transaction.recipient ? `${transaction.recipient.slice(0, 8)}...${transaction.recipient.slice(-6)}` : (received ? 'Unknown sender' : 'Unknown recipient'));
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(explorerTxUrl(transaction.digest))} className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 active:bg-slate-800">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-slate-200" numberOfLines={1}>{t(received ? 'receivedFromRecipient' : 'sentToRecipient', { recipient: counterparty })}</Text>
          <Text className="mt-1 text-xs text-slate-500">{date.toLocaleString(language, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
        </View>
        <Text className={`text-sm font-bold ${received ? 'text-emerald-400' : 'text-white'}`}>{received ? '+' : '-'}{fromBaseUnits(BigInt(transaction.amountBaseUnits), transaction.decimals)} {transaction.symbol}</Text>
      </View>
      <View className="flex-row items-center justify-between border-t border-slate-800 pt-3">
        <Text className="font-mono text-[10px] text-slate-500" numberOfLines={1}>{transaction.digest}</Text>
        <Text className="text-xs font-semibold text-blue-400">View on explorer</Text>
      </View>
    </Pressable>
  );
}
