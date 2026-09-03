import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { apiGet } from '@/lib/sui/api';
import { fromBaseUnits, SUI_COIN, USDC_COIN } from '@/lib/sui/coins';
import { requestTestnetSui } from '@/lib/sui/faucet';

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const address = session?.walletAddress;

  const refresh = useCallback(async () => {
    if (!address) {
      return;
    }
    setIsRefreshing(true);
    try {
      setBalances(await fetchBalances(address));
      setNotice(null);
    } catch (error) {
      setBalances((current) => current ?? []);
      setNotice(
        error instanceof Error
          ? `Could not load balances: ${error.message}`
          : 'Could not load balances. Pull to retry.',
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

  const onFaucet = useCallback(async () => {
    if (!address) {
      return;
    }
    setFaucetBusy(true);
    setNotice(null);
    try {
      await requestTestnetSui(address);
      setNotice('Testnet SUI requested. It should arrive in a few seconds.');
      setTimeout(() => void refresh(), 3000);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Faucet request failed.');
    } finally {
      setFaucetBusy(false);
    }
  }, [address, refresh]);

  if (!session) {
    return null;
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-950"
      contentContainerClassName="gap-5 px-5 py-8"
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
        <View className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5">
          <Text className="text-xs font-semibold text-emerald-300">Secure</Text>
        </View>
      </View>

      <View className="gap-1 pt-3">
        <Text className="text-sm text-slate-400">Welcome back</Text>
        <Text className="text-2xl font-bold text-white">{session.displayName}</Text>
        {session.email ? <Text className="text-sm text-slate-500">{session.email}</Text> : null}
      </View>

      <View className="gap-4 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-medium text-slate-400">Wallet balance</Text>
          <Text className="text-xs font-medium text-emerald-400">Sui testnet</Text>
        </View>
        {balances === null ? (
          <ActivityIndicator color="#94a3b8" />
        ) : (
          balances.map((row) => (
            <View key={row.coinType} className="flex-row items-baseline justify-between">
              <Text className="text-3xl font-bold tracking-tight text-white">
                {fromBaseUnits(BigInt(row.balance), row.decimals)}
              </Text>
              <Text className="text-sm font-medium text-slate-500">{row.symbol}</Text>
            </View>
          ))
        )}
        <Text className="border-t border-slate-800 pt-3 text-xs leading-5 text-slate-500">
          {USDC_COIN.symbol} is what RemitGuard sends. {SUI_COIN.symbol} pays the network fee.
        </Text>
      </View>

      <Link href="/(app)/send" asChild>
        <Pressable
          accessibilityRole="button"
          className="items-center rounded-xl bg-blue-600 px-5 py-4 shadow-lg shadow-blue-500/20 active:bg-blue-500"
        >
          <Text className="text-base font-bold text-white">Send money</Text>
        </Pressable>
      </Link>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Request testnet SUI"
        disabled={faucetBusy}
        onPress={onFaucet}
        className="flex-row items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-4 active:bg-slate-800 disabled:opacity-60"
      >
        {faucetBusy ? <ActivityIndicator /> : null}
        <Text className="text-base font-semibold text-slate-200">Add testnet SUI (gas)</Text>
      </Pressable>

      <View className="gap-3 pt-2">
        <Text className="text-sm font-semibold text-slate-300">Manage RemitGuard</Text>
        <View className="flex-row flex-wrap gap-2">
          {[
            ['Recipients', './recipients'],
            ['History', './history'],
            ['VeriPlan', './veriplan'],
            ['Settings', './settings'],
          ].map(([label, href]) => (
            <Link key={href} href={href as './recipients'} asChild>
              <Pressable className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 active:bg-slate-800">
                <Text className="text-sm font-semibold text-slate-300">{label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>

      {notice ? (
        <Text className="rounded-xl border border-blue-400/20 bg-blue-400/10 p-3 text-sm leading-5 text-blue-200" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      <View className="gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <Text className="text-sm font-medium text-slate-400">Sui wallet address</Text>
        <Text className="font-mono text-sm text-slate-200" selectable>
          {session.walletAddress}
        </Text>
        <Text className="font-mono text-xs text-slate-500">{shortAddress(session.walletAddress)}</Text>
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
        <Text className="text-base font-semibold text-slate-300">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
