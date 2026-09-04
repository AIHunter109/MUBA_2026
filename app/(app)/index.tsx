import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useAuth } from '@/lib/auth/auth-context';
import { apiGet } from '@/lib/sui/api';
import { fromBaseUnits, SUI_COIN, SUPPORTED_COINS, USDC_COIN } from '@/lib/sui/coins';
import { getTransactionLedger, type TransactionRecord } from '@/lib/transactions/ledger';
import { useI18n } from '@/lib/i18n/i18n-context';

type BalanceRow = { coinType: string; symbol: string; decimals: number; balance: string };

async function fetchBalances(address: string): Promise<BalanceRow[]> {
  const { balances } = await apiGet<{ balances: BalanceRow[] }>(
    `/v1/balances?owner=${encodeURIComponent(address)}`,
  );
  return balances;
}

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const { t } = useI18n();
  const [balances, setBalances] = useState<BalanceRow[] | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const address = session?.walletAddress;

  const refresh = useCallback(async () => {
    if (!address) {
      return;
    }
    setIsRefreshing(true);
    try {
      // The dashboard activity is local audit data, so keep it visible even if
      // the balance service is briefly unavailable.
      setTransactions(await getTransactionLedger());
      setBalances(await fetchBalances(address));
      setBalanceError(null);
    } catch (error) {
      setBalanceError(
        error instanceof Error ? error.message : 'Could not load balances. Pull to retry.',
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [address]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!session) {
    return null;
  }

  const displayBalances = SUPPORTED_COINS.map(
    (coin) =>
      balances?.find((row) => row.coinType === coin.type) ?? {
        coinType: coin.type,
        symbol: coin.symbol,
        decimals: coin.decimals,
        balance: '0',
      },
  );
  const usdcBalance = displayBalances.find((row) => row.symbol === USDC_COIN.symbol);
  const suiBalance = displayBalances.find((row) => row.symbol === SUI_COIN.symbol);
  const monthTransactions = transactions.filter((item) => isInCurrentMonth(item.occurredAt));

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#94a3b8" />
      }
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <Text className="text-lg font-bold text-white">R</Text>
          </View>
          <View>
            <Text className="text-lg font-bold tracking-tight text-white">RemitGuard</Text>
            <Text className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
              on Sui
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <Text className="text-xs font-semibold text-emerald-300">{t('safetyOn')}</Text>
        </View>
      </View>

      <View className="max-w-2xl gap-1 pt-1">
        <Text className="text-xs font-semibold uppercase tracking-widest text-blue-300">
          {t('remittanceDesk')}
        </Text>
        <Text className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          {t('goodToSee', { name: session.displayName.split(' ')[0] })}
        </Text>
        <Text className="max-w-xl text-sm leading-5 text-slate-400">
          {t('dashboardDescription')}
        </Text>
      </View>

      <View className="gap-4 md:flex-row md:items-stretch">
        <View className="w-full gap-4 rounded-3xl border border-blue-400/20 bg-slate-900 p-5 md:flex-1 md:p-6">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {t('availableBalance')}
              </Text>
              <Text className="mt-1 text-sm text-slate-400">{t('balanceDescription')}</Text>
            </View>
            <View className="rounded-full bg-blue-400/10 px-3 py-1.5">
              <Text className="text-xs font-semibold text-blue-300">Sui testnet</Text>
            </View>
          </View>

          {balances === null && !balanceError ? <ActivityIndicator color="#94a3b8" /> : null}
          <View className="flex-row gap-3">
            <BalanceTile
              label="USDC"
              value={usdcBalance ? fromBaseUnits(BigInt(usdcBalance.balance), usdcBalance.decimals) : '—'}
              detail={t('availableToSend')}
              unavailable={Boolean(balanceError)}
            />
            <BalanceTile
              label="SUI"
              value={suiBalance ? fromBaseUnits(BigInt(suiBalance.balance), suiBalance.decimals) : '—'}
              detail={t('networkGas')}
              unavailable={Boolean(balanceError)}
            />
          </View>
          {balanceError ? (
            <Text className="text-xs leading-5 text-amber-200">
              {balanceError}
            </Text>
          ) : null}

          <View className="gap-1 border-t border-slate-800 pt-3">
            <Text className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              {t('publicAddress')}
            </Text>
            <Text className="font-mono text-xs leading-5 text-slate-300" selectable>
              {session.walletAddress}
            </Text>
            <Text className="text-[11px] leading-4 text-slate-500">
              {t('publicAddressNote')}
            </Text>
          </View>

          <View className="flex-row gap-2 pt-1">
            <Link href="/(app)/send" asChild>
              <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 active:bg-blue-500">
                <Ionicons name="arrow-up-outline" size={18} color="#ffffff" />
                <Text className="font-bold text-white">{t('sendMoney')}</Text>
              </Pressable>
            </Link>
            <Pressable
              accessibilityRole="button"
              onPress={() => Alert.alert('Receive USDC', session.walletAddress)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 active:bg-slate-800"
            >
              <Ionicons name="arrow-down-outline" size={18} color="#94a3b8" />
              <Text className="font-semibold text-slate-200">{t('receive')}</Text>
            </Pressable>
          </View>
        </View>

        <View className="w-full gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:flex-1 md:p-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="receipt-outline" size={20} color="#60a5fa" />
              <Text className="text-base font-bold text-white">{t('recentTransactions')}</Text>
            </View>
            <Link href="/(app)/history">
              <Text className="text-sm font-semibold text-blue-400">{t('viewAll')}</Text>
            </Link>
          </View>
          {transactions.length ? (
            <View className="gap-3">
              {transactions.slice(0, 3).map((transaction) => (
                <TransactionRow key={transaction.digest} transaction={transaction} />
              ))}
            </View>
          ) : (
            <EmptyState
              title={t('noTransactions')}
              detail={t('firstTransfer')}
            />
          )}
        </View>
      </View>

      <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <View className="flex-row items-center gap-2">
          <Ionicons name="calendar-outline" size={20} color="#34d399" />
          <Text className="text-base font-bold text-white">{t('upcomingPayments')}</Text>
        </View>
        <EmptyState
          title={t('noUpcoming')}
          detail={t('recurringPlans')}
        />
      </View>

      <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold text-white md:text-lg">{t('thisMonth')}</Text>
          <Text className="text-xs text-slate-500">{t('paymentSummary')}</Text>
        </View>
        {monthTransactions.length ? (
          <MonthlySpendChart transactions={monthTransactions} t={t} />
        ) : (
          <EmptyState
            title={t('noMonthTransactions')}
            detail={t('monthlyTotals')}
          />
        )}
      </View>

      <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <View className="flex-row items-center gap-2">
          <Ionicons name="shield-checkmark-outline" size={20} color="#34d399" />
          <Text className="text-base font-bold text-white">{t('aiInsight')}</Text>
        </View>
        <Text className="text-sm leading-5 text-slate-400">
          {t('aiInsightText')}
        </Text>
      </View>

      {session.isDemo ? (
        <View className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
          <Text className="text-sm leading-5 text-amber-200">
            Demo session. This wallet was generated locally on this device and is not linked to a
            Google account.
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => {
          void signOut();
        }}
        className="items-center rounded-xl border border-slate-700 px-5 py-4 active:bg-slate-800"
      >
        <Text className="text-base font-semibold text-slate-300">{t('signOut')}</Text>
      </Pressable>
    </Screen>
  );
}

function isInCurrentMonth(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function shortAddress(address: string): string {
  return `${address.slice(0, 7)}...${address.slice(-4)}`;
}

function TransactionRow({ transaction }: { transaction: TransactionRecord }) {
  return (
    <View className="flex-row items-center justify-between border-b border-slate-800 pb-3 last:border-b-0 last:pb-0">
      <View className="min-w-0 flex-1 gap-0.5 pr-3">
        <Text className="text-sm font-semibold text-slate-200">Sent to {shortAddress(transaction.recipient)}</Text>
        <Text className="text-xs text-slate-500">
          {new Date(transaction.occurredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
      </View>
      <Text className="text-sm font-bold text-white">
        −{fromBaseUnits(BigInt(transaction.amountBaseUnits), transaction.decimals)} {transaction.symbol}
      </Text>
    </View>
  );
}

function BalanceTile({
  label,
  value,
  detail,
  unavailable,
}: {
  label: string;
  value: string;
  detail: string;
  unavailable: boolean;
}) {
  return (
    <View className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <Text className="text-xs font-semibold text-blue-300">{label}</Text>
      <Text className="mt-2 text-2xl font-bold tracking-tight text-white" numberOfLines={1}>
        {unavailable ? '—' : value}
      </Text>
      <Text className="mt-1 text-[11px] text-slate-500">{detail}</Text>
    </View>
  );
}

function MonthlySpendChart({ transactions, t }: { transactions: TransactionRecord[]; t: (key: string) => string }) {
  const usdcTransactions = transactions.filter((item) => item.symbol === 'USDC');
  const totalUsdc = usdcTransactions.reduce(
    (sum, item) => sum + Number(fromBaseUnits(BigInt(item.amountBaseUnits), item.decimals)),
    0,
  );
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const total = usdcTransactions
      .filter((item) => new Date(item.occurredAt).toDateString() === date.toDateString())
      .reduce((sum, item) => sum + Number(fromBaseUnits(BigInt(item.amountBaseUnits), item.decimals)), 0);
    return { label: date.toLocaleDateString(undefined, { weekday: 'narrow' }), total };
  });
  const max = Math.max(...days.map((day) => day.total), 1);

  return (
    <View className="gap-4">
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-2xl font-bold text-white">{totalUsdc.toLocaleString()} USDC</Text>
          <Text className="mt-1 text-xs text-slate-500">{t('sentThisMonth')}</Text>
        </View>
        <Text className="text-xs text-slate-500">{t('last7Days')}</Text>
      </View>
      <View className="h-28 flex-row items-end justify-between gap-2 border-b border-slate-800 pb-1">
        {days.map((day, index) => (
          <View key={`${day.label}-${index}`} className="flex-1 items-center gap-2">
            <View className="h-20 w-full justify-end rounded-t-md bg-slate-800/70">
              <View
                className="w-full rounded-t-md bg-blue-500"
                style={{ height: `${Math.max((day.total / max) * 100, day.total ? 8 : 0)}%` }}
              />
            </View>
            <Text className="text-[10px] font-medium text-slate-500">{day.label}</Text>
          </View>
        ))}
      </View>
      {transactions.some((item) => item.symbol === 'SUI') ? (
        <Text className="text-xs leading-5 text-slate-500">
          {t('suiChartNote')}
        </Text>
      ) : null}
    </View>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View className="items-center gap-1 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-5 py-6">
      <Text className="text-sm font-semibold text-slate-300">{title}</Text>
      <Text className="text-center text-xs leading-5 text-slate-500">{detail}</Text>
    </View>
  );
}
