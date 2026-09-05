import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/translated-text';

import { AppPage } from '@/components/app-page';
import { useAuth } from '@/lib/auth/auth-context';
import { LANGUAGES, useI18n } from '@/lib/i18n/i18n-context';
import { requestTestnetSui } from '@/lib/sui/faucet';

function FeatureLink({
  icon,
  title,
  detail,
  href,
  actionLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  href: '/(app)/settings/budget-planner' | '/(app)/settings/guardians' | '/(app)/settings/payment-policies';
  actionLabel: string;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={20} color="#60a5fa" />
        <Text className="text-base font-bold text-white">{title}</Text>
      </View>
      <Text className="text-sm leading-5 text-slate-400">{detail}</Text>
      <Link href={href} asChild>
        <Pressable
          accessibilityRole="link"
          className="self-start rounded-lg border border-blue-400/30 bg-blue-400/10 px-4 py-2.5 active:bg-blue-400/20"
        >
          <Text className="text-sm font-semibold text-blue-300">{actionLabel}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

export default function SettingsScreen() {
  const { session } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const { height } = useWindowDimensions();
  const languageListHeight = Math.min(224, Math.max(128, height * 0.26));
  const [isRequesting, setIsRequesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const walletAddress = session?.walletAddress;

  const requestGas = useCallback(async () => {
    if (!walletAddress) {
      return;
    }
    setIsRequesting(true);
    setNotice(null);
    try {
      await requestTestnetSui(walletAddress);
      setNotice('Testnet SUI requested. It should arrive in a few seconds.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Faucet request failed.');
    } finally {
      setIsRequesting(false);
    }
  }, [walletAddress]);

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

        {/* On native, these three don't fit as their own tab bar icons (the
            bottom bar caps at 5), so they're reached from here instead - the
            same "hub" pattern web already used for Payment policies. Web's
            sidebar/bottom-bar still link to them directly too; this is just
            an additional, always-available way in. */}
        <FeatureLink
          icon="calculator-outline"
          title="Budget Planner"
          detail="Build a monthly budget and set up a recurring remittance from it."
          href="/(app)/settings/budget-planner"
          actionLabel="Open Budget Planner"
        />
        <FeatureLink
          icon="shield-checkmark-outline"
          title="Guardians"
          detail="Add a trusted wallet to review protected payments before money moves."
          href="/(app)/settings/guardians"
          actionLabel="Manage guardians"
        />
        <FeatureLink
          icon="options-outline"
          title="Payment policies"
          detail="Set high-value thresholds, new-recipient and changed-wallet protection, plus Guardian approval."
          href="/(app)/settings/payment-policies"
          actionLabel="Manage payment policies"
        />
      </View>
    </AppPage>
  );
}
