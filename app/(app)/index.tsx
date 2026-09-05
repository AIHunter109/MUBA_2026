import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, Text, useWindowDimensions, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useAuth } from '@/lib/auth/auth-context';
import { apiGet } from '@/lib/sui/api';
import { fromBaseUnits, SUI_COIN, SUPPORTED_COINS, toBaseUnits, USDC_COIN } from '@/lib/sui/coins';
import { getTransactionLedger, type TransactionRecord } from '@/lib/transactions/ledger';
import { useI18n } from '@/lib/i18n/i18n-context';

type BalanceRow = { coinType: string; symbol: string; decimals: number; balance: string };
type BalanceApiResponse = { balances: BalanceRow[]; offline?: boolean };
type SuiBalanceResponse = { totalBalance?: string };
type SuiJsonRpcResponse = {
  result?: SuiBalanceResponse;
  error?: { message?: string };
};

// This is a browser/device fallback for when the local API cannot reach Sui.
// It only reads public on-chain balance data; transfers still use the API flow.
const SUI_TESTNET_RPC_URL = 'https://sui-testnet-rpc.publicnode.com';
type StoredTransaction = {
  digest: string;
  recipient: string;
  recipientName?: string;
  amount: string;
  asset: 'USDC' | 'SUI';
  status: 'success';
  occurredAt: string;
};
type RecurringRule = {
  id: string;
  recipientName: string;
  recipientAddress: string;
  amount: string;
  asset: 'USDC' | 'SUI';
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  nextTriggerAt: string;
};

async function fetchBalances(address: string): Promise<BalanceRow[]> {
  let apiFallback: BalanceRow[] | null = null;
  let apiError: unknown;

  try {
    const response = await apiGet<BalanceApiResponse>(
      `/v1/balances?owner=${encodeURIComponent(address)}`,
    );
    if (!response.offline) {
      return response.balances;
    }
    apiFallback = response.balances;
  } catch (error) {
    apiError = error;
  }

  try {
    const balances = await Promise.all(
      SUPPORTED_COINS.map(async (coin, index): Promise<BalanceRow> => {
        const response = await fetch(SUI_TESTNET_RPC_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: index + 1,
            method: 'suix_getBalance',
            params: [address, coin.type],
          }),
        });
        if (!response.ok) {
          throw new Error(`Sui balance request failed (${response.status}).`);
        }
        const body = (await response.json()) as SuiJsonRpcResponse;
        if (body.error) {
          throw new Error(body.error.message ?? 'Sui balance request failed.');
        }
        return {
          coinType: coin.type,
          symbol: coin.symbol,
          decimals: coin.decimals,
          balance: body.result?.totalBalance ?? '0',
        };
      }),
    );
    return balances;
  } catch (directError) {
    if (apiFallback) {
      return apiFallback;
    }
    throw apiError ?? directError;
  }
}

async function fetchStoredTransactions(address: string): Promise<TransactionRecord[]> {
  const { transactions } = await apiGet<{ transactions: StoredTransaction[] }>(
    `/v1/transactions?owner=${encodeURIComponent(address)}`,
  );
  return transactions.map((transaction) => {
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
      status: 'success',
    };
  });
}

async function fetchRecurringRules(address: string): Promise<RecurringRule[]> {
  const { rules } = await apiGet<{ rules: RecurringRule[] }>(
    `/v1/recurring-rules?owner=${encodeURIComponent(address)}`,
  );
  return rules;
}

function mergeTransactions(...ledgers: TransactionRecord[][]): TransactionRecord[] {
  const byDigest = new Map<string, TransactionRecord>();
  for (const ledger of ledgers) {
    for (const transaction of ledger) {
      byDigest.set(transaction.digest, transaction);
    }
  }
  return [...byDigest.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const { t } = useI18n();
  const [balances, setBalances] = useState<BalanceRow[] | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { width } = useWindowDimensions();

  const address = session?.walletAddress;

  const refresh = useCallback(async () => {
    if (!address) {
      return;
    }
    setIsRefreshing(true);
    try {
      const localTransactions = await getTransactionLedger();
      // The server ledger follows the user across web and native. Keep the local
      // copy as an offline fallback if the API is temporarily unavailable.
      const storedTransactions = await fetchStoredTransactions(address).catch(() => []);
      const storedRules = await fetchRecurringRules(address).catch(() => []);
      setTransactions(mergeTransactions(localTransactions, storedTransactions));
      setRecurringRules(storedRules);
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
  const isNarrow = width < 380;
  const hasSidebar = width >= 1024;
  const hasTwoColumnSpace = width >= 1080;

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#94a3b8" />
      }
    >
      {!hasSidebar ? (
        <View
          className="justify-between"
          style={{ flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'flex-start' : 'center', gap: isNarrow ? 12 : 0 }}
        >
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
          <SafetyBadge label={t('safetyOn')} />
        </View>
      ) : null}

      <View className="max-w-2xl gap-1 pt-1">
        <Text className="text-xs font-semibold uppercase tracking-widest text-blue-300">
          {t('remittanceDesk')}
        </Text>
        <Text className="font-bold tracking-tight text-white" style={{ fontSize: isNarrow ? 23 : 28 }}>
          {t('goodToSee', { name: session.displayName.split(' ')[0] })}
        </Text>
        <Text className="max-w-xl text-sm leading-5 text-slate-400">
          {t('dashboardDescription')}
        </Text>
      </View>

      <View className="gap-4" style={{ flexDirection: hasTwoColumnSpace ? 'row' : 'column', alignItems: 'stretch' }}>
        <View className="w-full gap-4 rounded-3xl border border-blue-400/20 bg-slate-900 p-5" style={{ flex: hasTwoColumnSpace ? 1 : undefined }}>
          <View className="justify-between" style={{ flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'flex-start' : 'center', gap: isNarrow ? 10 : 0 }}>
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

          <View className="gap-2 pt-1" style={{ flexDirection: isNarrow ? 'column' : 'row' }}>
            <Link href="/(app)/send" asChild>
              <Pressable className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 active:bg-blue-500" style={{ flex: isNarrow ? undefined : 1 }}>
                <Ionicons name="arrow-up-outline" size={18} color="#ffffff" />
                <Text className="font-bold text-white">{t('sendMoney')}</Text>
              </Pressable>
            </Link>
            <Pressable
              accessibilityRole="button"
              onPress={() => Alert.alert('Receive USDC', session.walletAddress)}
              className="flex-row items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 active:bg-slate-800"
              style={{ flex: isNarrow ? undefined : 1 }}
            >
              <Ionicons name="arrow-down-outline" size={18} color="#94a3b8" />
              <Text className="font-semibold text-slate-200">{t('receive')}</Text>
            </Pressable>
          </View>
        </View>

        <View className="w-full gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-5" style={{ flex: hasTwoColumnSpace ? 1 : undefined }}>
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
                <TransactionRow key={transaction.digest} transaction={transaction} compact={isNarrow} />
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
        {recurringRules.length ? (
          <View className="gap-3">
            {recurringRules.slice(0, 3).map((rule) => (
              <UpcomingPaymentRow key={rule.id} rule={rule} />
            ))}
          </View>
        ) : (
          <EmptyState
            title={t('noUpcoming')}
            detail={t('recurringPlans')}
          />
        )}
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

function TransactionRow({ transaction, compact }: { transaction: TransactionRecord; compact: boolean }) {
  return (
    <View className="justify-between border-b border-slate-800 pb-3 last:border-b-0 last:pb-0" style={{ flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'flex-start' : 'center', gap: compact ? 4 : 0 }}>
      <View className="min-w-0 flex-1 gap-0.5 pr-3">
        <Text className="text-sm font-semibold text-slate-200" numberOfLines={1}>Sent to {transaction.recipientName ?? shortAddress(transaction.recipient)}</Text>
        <Text className="text-xs text-slate-500">
          {new Date(transaction.occurredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
      </View>
      <Text className="text-sm font-bold text-white" numberOfLines={1}>
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
  // Do not render a zero-value USDC chart after a real SUI transfer. Keep assets
  // separate because their units cannot be added together meaningfully.
  const chartSymbol = transactions.some((item) => item.symbol === 'USDC') ? 'USDC' : 'SUI';
  const chartTransactions = transactions.filter((item) => item.symbol === chartSymbol);
  const chartTotal = chartTransactions.reduce(
    (sum, item) => sum + Number(fromBaseUnits(BigInt(item.amountBaseUnits), item.decimals)),
    0,
  );
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const total = chartTransactions
      .filter((item) => new Date(item.occurredAt).toDateString() === date.toDateString())
      .reduce((sum, item) => sum + Number(fromBaseUnits(BigInt(item.amountBaseUnits), item.decimals)), 0);
    return { label: date.toLocaleDateString(undefined, { weekday: 'narrow' }), total };
  });
  const max = Math.max(...days.map((day) => day.total), 1);

  return (
    <View className="gap-4">
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-2xl font-bold text-white">{chartTotal.toLocaleString()} {chartSymbol}</Text>
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
      {transactions.some((item) => item.symbol !== chartSymbol) ? (
        <Text className="text-xs leading-5 text-slate-500">
          {chartSymbol === 'USDC' ? t('suiChartNote') : 'USDC transfers are shown separately.'}
        </Text>
      ) : null}
    </View>
  );
}

function UpcomingPaymentRow({ rule }: { rule: RecurringRule }) {
  const nextDate = new Date(rule.nextTriggerAt);
  const cadence = rule.frequency.charAt(0) + rule.frequency.slice(1).toLowerCase();
  return (
    <View className="flex-row items-center justify-between border-b border-slate-800 pb-3 last:border-b-0 last:pb-0">
      <View className="min-w-0 flex-1 gap-0.5 pr-3">
        <Text className="text-sm font-semibold text-slate-200" numberOfLines={1}>
          {rule.recipientName}
        </Text>
        <Text className="text-xs text-slate-500">
          {cadence} · Next {nextDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
      </View>
      <Text className="text-sm font-bold text-white" numberOfLines={1}>
        {rule.amount} {rule.asset}
      </Text>
    </View>
  );
}

function SafetyBadge({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5">
      <View className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      <Text className="text-xs font-semibold text-emerald-300">{label}</Text>
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
