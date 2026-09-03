import { AppPage, PlaceholderCard } from '@/components/app-page';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { requestTestnetSui } from '@/lib/sui/faucet';

export default function SettingsScreen() {
  const { session } = useAuth();
  const [isRequesting, setIsRequesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const requestGas = useCallback(async () => {
    if (!session?.walletAddress) return;
    setIsRequesting(true);
    setNotice(null);
    try {
      await requestTestnetSui(session.walletAddress);
      setNotice('Testnet SUI requested. It should arrive in a few seconds.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Faucet request failed.');
    } finally {
      setIsRequesting(false);
    }
  }, [session?.walletAddress]);

  return (
    <ScrollView className="flex-1 bg-slate-950" contentContainerClassName="gap-5">
      <AppPage title="Settings" subtitle="Configure approval safeguards and account preferences.">
        <View className="gap-3">
          <View className="gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <View className="flex-row items-center gap-2"><Ionicons name="wallet-outline" size={20} color="#60a5fa" /><Text className="text-base font-bold text-white">Wallet & Network</Text></View>
            <Text className="text-xs uppercase tracking-widest text-slate-500">Sui Testnet wallet</Text>
            <Text className="font-mono text-sm leading-5 text-slate-300" selectable>{session?.walletAddress}</Text>
            <Pressable accessibilityRole="button" disabled={isRequesting} onPress={() => void requestGas()} className="flex-row items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 active:bg-slate-800 disabled:opacity-60">
              {isRequesting ? <ActivityIndicator color="#94a3b8" /> : <Ionicons name="water-outline" size={18} color="#94a3b8" />}
              <Text className="text-sm font-semibold text-slate-200">Request testnet SUI for gas</Text>
            </Pressable>
            {notice ? <Text className="text-xs leading-5 text-blue-300" accessibilityLiveRegion="polite">{notice}</Text> : null}
          </View>
          <PlaceholderCard
            title="Guardians"
            detail="Trusted people who can provide a second approval for high-value or high-risk payments."
            action="Add guardian"
          />
          <PlaceholderCard
            title="Payment policies"
            detail="Set thresholds and rules for new recipients, changed wallets, and second-person approval."
            action="Add policy"
          />
          <PlaceholderCard
            title="Notifications and language"
            detail="Notification preferences and language selection will be available here."
          />
        </View>
      </AppPage>
    </ScrollView>
  );
}
