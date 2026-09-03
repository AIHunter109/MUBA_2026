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
      className="flex-1 bg-white"
      contentContainerClassName="gap-6 px-6 py-10"
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
    >
      <Stack.Screen options={{ title: 'Home', headerShown: false }} />

      <View className="gap-1">
        <Text className="text-sm text-slate-500">Signed in as</Text>
        <Text className="text-lg font-semibold text-slate-950">{session.displayName}</Text>
        {session.email ? <Text className="text-sm text-slate-500">{session.email}</Text> : null}
      </View>

      <View className="gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <Text className="text-sm text-slate-500">Testnet balances</Text>
        {balances === null ? (
          <ActivityIndicator />
        ) : (
          balances.map((row) => (
            <View key={row.coinType} className="flex-row items-baseline justify-between">
              <Text className="text-2xl font-bold text-slate-950">
                {fromBaseUnits(BigInt(row.balance), row.decimals)}
              </Text>
              <Text className="text-sm font-medium text-slate-500">{row.symbol}</Text>
            </View>
          ))
        )}
        <Text className="text-xs text-slate-400">
          {USDC_COIN.symbol} is what RemitGuard sends. {SUI_COIN.symbol} pays the network fee.
        </Text>
      </View>

      <Link href="/(app)/send" asChild>
        <Pressable
          accessibilityRole="button"
          className="items-center rounded-xl bg-emerald-700 px-5 py-4 active:bg-emerald-800"
        >
          <Text className="text-base font-bold text-white">Send</Text>
        </Pressable>
      </Link>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Request testnet SUI"
        disabled={faucetBusy}
        onPress={onFaucet}
        className="flex-row items-center justify-center gap-3 rounded-xl border border-slate-300 px-5 py-4 active:bg-slate-100 disabled:opacity-60"
      >
        {faucetBusy ? <ActivityIndicator /> : null}
        <Text className="text-base font-semibold text-slate-800">Add testnet SUI (gas)</Text>
      </Pressable>

      {notice ? (
        <Text className="text-sm leading-5 text-slate-600" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      <View className="gap-2 rounded-2xl border border-slate-200 p-5">
        <Text className="text-sm text-slate-500">Sui wallet address</Text>
        <Text className="font-mono text-sm text-slate-900" selectable>
          {session.walletAddress}
        </Text>
        <Text className="font-mono text-xs text-slate-400">{shortAddress(session.walletAddress)}</Text>
      </View>

      {session.isDemo ? (
        <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Text className="text-sm leading-5 text-amber-900">
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
        className="items-center rounded-xl border border-slate-300 px-5 py-4 active:bg-slate-100"
      >
        <Text className="text-base font-semibold text-slate-800">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
