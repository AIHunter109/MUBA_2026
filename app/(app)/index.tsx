import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { fromBaseUnits, SUI_COIN, SUPPORTED_COINS, USDC_COIN } from '@/lib/sui/coins';
import { requestTestnetSui } from '@/lib/sui/faucet';
import { getSuiClient } from '@/lib/sui/sui-client';

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type Balances = Record<string, bigint>;

async function fetchBalances(address: string): Promise<Balances> {
  const client = getSuiClient();
  const results = await Promise.allSettled(
    SUPPORTED_COINS.map((coin) => client.core.getBalance({ owner: address, coinType: coin.type })),
  );

  const balances: Balances = {};
  let failures = 0;
  results.forEach((result, index) => {
    const coinType = SUPPORTED_COINS[index].type;
    if (result.status === 'fulfilled') {
      balances[coinType] = BigInt(result.value.balance.balance);
    } else {
      failures += 1;
      balances[coinType] = 0n;
    }
  });

  if (failures === SUPPORTED_COINS.length) {
    const first = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    throw first?.reason instanceof Error ? first.reason : new Error('Balance lookup failed.');
  }

  return balances;
}

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const [balances, setBalances] = useState<Balances | null>(null);
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
      setBalances((current) => current ?? {});
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
        {balances ? (
          SUPPORTED_COINS.map((coin) => (
            <View key={coin.type} className="flex-row items-baseline justify-between">
              <Text className="text-2xl font-bold text-slate-950">
                {fromBaseUnits(balances[coin.type] ?? 0n, coin.decimals)}
              </Text>
              <Text className="text-sm font-medium text-slate-500">{coin.symbol}</Text>
            </View>
          ))
        ) : (
          <ActivityIndicator />
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
