import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { apiGet } from '@/lib/sui/api';
import { fromBaseUnits, SUI_COIN, SUPPORTED_COINS, USDC_COIN } from '@/lib/sui/coins';

type BalanceRow = { coinType: string; symbol: string; decimals: number; balance: string };

async function fetchBalances(address: string): Promise<BalanceRow[]> {
  const { balances } = await apiGet<{ balances: BalanceRow[] }>(
    `/v1/balances?owner=${encodeURIComponent(address)}`,
  );
  return balances;
}

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const [balances, setBalances] = useState<BalanceRow[] | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const address = session?.walletAddress;

  const refresh = useCallback(async () => {
    if (!address) {
      return;
    }
    setIsRefreshing(true);
    try {
      setBalances(await fetchBalances(address));
      setBalanceError(null);
    } catch (error) {
      setBalanceError(error instanceof Error ? error.message : 'Could not load balances. Pull to retry.');
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

  const displayBalances = SUPPORTED_COINS.map((coin) =>
    balances?.find((row) => row.coinType === coin.type) ?? {
      coinType: coin.type,
      symbol: coin.symbol,
      decimals: coin.decimals,
      balance: '0',
    },
  );
  const usdcBalance = displayBalances.find((row) => row.symbol === USDC_COIN.symbol);
  const suiBalance = displayBalances.find((row) => row.symbol === SUI_COIN.symbol);

  return (
    <ScrollView
      className="flex-1 bg-slate-950"
      contentContainerClassName="w-full max-w-[1120px] self-center gap-5 px-5 pb-28 pt-7 md:gap-6 md:px-10 md:py-9"
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
    >
      <Stack.Screen options={{ title: 'Home', headerShown: false }} />

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <Text className="text-lg font-bold text-white">R</Text>
            </View>
            <View>
              <Text className="text-lg font-bold tracking-tight text-white">RemitGuard</Text>
              <Text className="text-[10px] font-medium uppercase tracking-widest text-slate-500">on Sui</Text>
            </View>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <Text className="text-xs font-semibold text-emerald-300">Safety on</Text>
        </View>
      </View>

      <View className="max-w-2xl gap-1 pt-1">
        <Text className="text-xs font-semibold uppercase tracking-widest text-blue-300">Your remittance desk</Text>
        <Text className="text-2xl font-bold tracking-tight text-white md:text-3xl">Good to see you, {session.displayName.split(' ')[0]}</Text>
        <Text className="max-w-xl text-sm leading-5 text-slate-400">Plan, review, and send support across borders with confidence.</Text>
      </View>

      <View className="gap-4 md:flex-row md:items-stretch">
        <View className="w-full gap-4 rounded-3xl border border-blue-400/20 bg-slate-900 p-5 md:flex-1 md:p-6">
          <View className="flex-row items-center justify-between">
            <View><Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">Available balance</Text><Text className="mt-1 text-sm text-slate-400">Ready for your next transfer</Text></View>
            <View className="rounded-full bg-blue-400/10 px-3 py-1.5"><Text className="text-xs font-semibold text-blue-300">Sui testnet</Text></View>
          </View>
          {balances === null ? (balanceError ? <Text className="text-sm leading-5 text-amber-200">{balanceError}</Text> : <ActivityIndicator color="#94a3b8" />) : (
            <View className="gap-3">
              {usdcBalance ? <View className="flex-row items-end justify-between"><View><Text className="text-4xl font-bold tracking-tight text-white md:text-5xl">{fromBaseUnits(BigInt(usdcBalance.balance), usdcBalance.decimals)}</Text><Text className="mt-1 text-sm font-semibold text-blue-300">USDC</Text><Text className="mt-2 text-xs text-slate-500">Approx. MYR value unavailable</Text></View></View> : null}
              {suiBalance ? <View className="flex-row items-baseline justify-between border-t border-slate-800 pt-3"><Text className="text-lg font-semibold text-slate-300">{fromBaseUnits(BigInt(suiBalance.balance), suiBalance.decimals)} <Text className="text-sm text-slate-500">SUI</Text></Text><Text className="text-xs text-slate-500">Network gas</Text></View> : null}
            </View>
          )}
          <View className="flex-row gap-2 pt-1">
            <Link href="/(app)/send" asChild><Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 active:bg-blue-500"><Ionicons name="arrow-up-outline" size={18} color="#fff" /><Text className="font-bold text-white">Send Money</Text></Pressable></Link>
            <Pressable accessibilityRole="button" onPress={() => Alert.alert('Receive USDC', session.walletAddress)} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 active:bg-slate-800"><Ionicons name="arrow-down-outline" size={18} color="#94a3b8" /><Text className="font-semibold text-slate-200">Receive</Text></Pressable>
          </View>
        </View>

        <View className="w-full gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:flex-1 md:p-6">
          <View className="flex-row items-center justify-between"><View className="flex-row items-center gap-2"><Ionicons name="receipt-outline" size={20} color="#60a5fa" /><Text className="text-base font-bold text-white">Recent Transactions</Text></View><Link href="/(app)/history"><Text className="text-sm font-semibold text-blue-400">View all history</Text></Link></View>
          <EmptyState title="No transactions yet" detail="Your first confirmed transfer will show up here." />
        </View>
      </View>

      <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <View className="flex-row items-center justify-between"><View className="flex-row items-center gap-2"><Ionicons name="calendar-outline" size={20} color="#34d399" /><Text className="text-base font-bold text-white">Upcoming Payments</Text></View><Link href="/(app)/veriplan"><Text className="text-sm font-semibold text-blue-400">View all</Text></Link></View>
        <EmptyState title="No upcoming payments" detail="Your confirmed recurring plans will appear here." />
      </View>

      <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold text-white md:text-lg">This month</Text>
          <Text className="text-xs text-slate-500">Payment summary</Text>
        </View>
        <EmptyState title="No transactions this month" detail="Your monthly totals will appear after your first transfer." />
      </View>

      <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <View className="flex-row items-center gap-2"><Ionicons name="shield-checkmark-outline" size={20} color="#34d399" /><Text className="text-base font-bold text-white">RemitGuard AI Insight</Text></View>
        <Text className="text-sm leading-5 text-slate-400">AI safety check is ready. No transfer currently requires a heuristic risk review.</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => {
          void signOut();
        }}
        className="items-center rounded-xl border border-slate-700 px-5 py-4 active:bg-slate-800"
      >
        <Text className="text-base font-semibold text-slate-300">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <View className="items-center gap-1 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-5 py-6"><Text className="text-sm font-semibold text-slate-300">{title}</Text><Text className="text-center text-xs leading-5 text-slate-500">{detail}</Text></View>;
}
