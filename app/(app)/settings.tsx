import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/translated-text';

import { AppPage } from '@/components/app-page';
import { useAuth } from '@/lib/auth/auth-context';
import { LANGUAGES, useI18n } from '@/lib/i18n/i18n-context';
import { requestTestnetSui } from '@/lib/sui/faucet';

export default function SettingsScreen() {
  const { session } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const { height } = useWindowDimensions();
  const languageListHeight = Math.min(224, Math.max(128, height * 0.26));
  const [isRequesting, setIsRequesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const requestGas = useCallback(async () => {
    if (!session?.walletAddress) {
      return;
    }
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
    <AppPage title={t('settings')} subtitle="Configure approval safeguards and account preferences.">
      <View className="gap-3">
        <View className="gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="wallet-outline" size={20} color="#60a5fa" />
            <Text className="text-base font-bold text-white">{t('walletNetwork')}</Text>
          </View>
          <Text className="text-xs uppercase tracking-widest text-slate-500">{t('suiTestnetWallet')}</Text>
          <Text className="font-mono text-sm leading-5 text-slate-300" selectable>
            {session?.walletAddress}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={isRequesting}
            onPress={() => void requestGas()}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 active:bg-slate-800 disabled:opacity-60"
          >
            {isRequesting ? (
              <ActivityIndicator color="#94a3b8" />
            ) : (
              <Ionicons name="water-outline" size={18} color="#94a3b8" />
            )}
            <Text className="text-sm font-semibold text-slate-200">{t('requestGas')}</Text>
          </Pressable>
          {notice ? (
            <Text className="text-xs leading-5 text-blue-300" accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}
        </View>

        <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="language-outline" size={20} color="#60a5fa" />
            <Text className="text-base font-bold text-white">{t('language')}</Text>
          </View>
          <Text className="text-sm leading-5 text-slate-400">{t('languageDetail')}</Text>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={{ maxHeight: languageListHeight, width: '100%' }}
            className="rounded-xl border border-slate-800 bg-slate-950/40"
            contentContainerStyle={{ gap: 8, padding: 8 }}
          >
            {LANGUAGES.map((option) => {
              const selected = language === option.code;
              return (
                <Pressable key={option.code} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => void setLanguage(option.code)} style={{ alignSelf: 'stretch' }} className={`rounded-lg border px-3 py-3 ${selected ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-900/60'}`}>
                  <Text className={`text-left text-sm font-semibold ${selected ? 'text-blue-300' : 'text-slate-300'}`}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><Text className="text-base font-semibold text-white">Payment policies</Text><Text className="text-sm leading-5 text-slate-400">Set high-value thresholds, new-recipient and changed-wallet protection, plus Guardian approval.</Text><Link href="/(app)/payment-policies" asChild><Pressable accessibilityRole="link" className="self-start rounded-lg border border-blue-400/30 bg-blue-400/10 px-4 py-2.5 active:bg-blue-400/20"><Text className="text-sm font-semibold text-blue-300">Manage payment policies</Text></Pressable></Link></View>
      </View>
    </AppPage>
  );
}
