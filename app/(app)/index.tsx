import { Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function HomeScreen() {
  const { session, signOut } = useAuth();

  if (!session) {
    return null;
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="gap-6 px-6 py-10">
      <Stack.Screen options={{ title: 'Home', headerShown: false }} />

      <View className="gap-1">
        <Text className="text-sm text-slate-500">Signed in as</Text>
        <Text className="text-lg font-semibold text-slate-950">{session.displayName}</Text>
        <Text className="text-sm text-slate-500">{session.email}</Text>
      </View>

      <View className="gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <Text className="text-sm text-slate-500">Testnet balance</Text>
        <Text className="text-3xl font-bold text-slate-950">-- USDC</Text>
        <Text className="text-xs text-slate-400">
          Balance loads once the wallet is funded (Phase 2 settlement slice).
        </Text>
      </View>

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
            Demo session. This wallet was generated locally on this device and is not
            linked to a Google account.
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
