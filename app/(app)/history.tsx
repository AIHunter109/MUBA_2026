import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import { fromBaseUnits } from '@/lib/sui/coins';
import { explorerTxUrl } from '@/lib/sui/network';
import { getReceivedTransfers, type ReceivedTransfer } from '@/lib/transactions/history';

export default function HistoryScreen() {
  const { session } = useAuth();
  const { t } = useI18n();
  const [transactions, setTransactions] = useState<ReceivedTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.walletAddress) {
      return;
    }
    setError(null);
    try {
      setTransactions(await getReceivedTransfers(session.walletAddress));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('historyLoadError'));
    } finally {
      setIsLoading(false);
    }
  }, [session?.walletAddress, t]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#94a3b8" />}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-3xl font-bold tracking-tight text-white">{t('transactionHistory')}</Text>
          <Text className="text-sm leading-5 text-slate-400">{t('historySubtitle')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('refreshHistory')}
          onPress={() => void refresh()}
          className="h-11 w-11 items-center justify-center rounded-xl border border-slate-700 active:bg-slate-800"
        >
          <Ionicons name="refresh-outline" size={20} color="#94a3b8" />
        </Pressable>
      </View>

      {isLoading && !transactions.length ? <ActivityIndicator color="#94a3b8" /> : null}
      {error ? <Text className="text-sm leading-5 text-amber-200">{error}</Text> : null}

      {transactions.length ? (
        <View className="gap-3">
          {transactions.map((transaction) => (
            <ReceivedTransactionRow key={`${transaction.digest}-${transaction.coinType}`} transaction={transaction} />
          ))}
        </View>
      ) : !isLoading && !error ? (
        <View className="items-center gap-1 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-5 py-8">
          <Text className="text-sm font-semibold text-slate-300">{t('historyEmpty')}</Text>
          <Text className="text-center text-xs leading-5 text-slate-500">{t('historyDetail')}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

function ReceivedTransactionRow({ transaction }: { transaction: ReceivedTransfer }) {
  const { language, t } = useI18n();
  const sender = transaction.sender ? shortenAddress(transaction.sender) : t('unknownSender');

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('explorer')}
      onPress={() => void Linking.openURL(explorerTxUrl(transaction.digest))}
      className="flex-row items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 active:bg-slate-800"
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10">
          <Ionicons name="arrow-down-outline" size={20} color="#34d399" />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-sm font-semibold text-slate-100" numberOfLines={1}>
            {t('receivedFrom', { sender })}
          </Text>
          <Text className="text-xs text-slate-500">
            {new Date(transaction.occurredAt).toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
      </View>
      <Text className="text-sm font-bold text-emerald-300" numberOfLines={1}>
        +{fromBaseUnits(BigInt(transaction.amountBaseUnits), transaction.decimals)} {transaction.symbol}
      </Text>
    </Pressable>
  );
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 7)}...${address.slice(-4)}`;
}
