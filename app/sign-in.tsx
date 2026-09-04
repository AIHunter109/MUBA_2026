import { Stack } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { DEMO_MODE, isEnokiConfigured } from '@/lib/auth/enoki-config';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function SignInScreen() {
  const { signIn, isAuthenticating, error } = useAuth();
  const { t } = useI18n();

  return (
    <View className="flex-1 justify-center gap-8 bg-slate-950 px-5">
      <Stack.Screen options={{ title: 'Sign in', headerShown: false }} />

      <View className="gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/25">
          <Text className="text-2xl font-bold text-white">R</Text>
        </View>
        <Text className="text-4xl font-bold tracking-tight text-white">RemitGuard</Text>
        <Text className="text-base leading-6 text-slate-400">
          {t('signInDescription')}
        </Text>
      </View>

      <View className="gap-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          disabled={isAuthenticating}
          onPress={() => {
            void signIn();
          }}
          className="flex-row items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-4 shadow-lg shadow-blue-500/20 active:bg-blue-500 disabled:opacity-60"
        >
          {isAuthenticating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-base font-bold text-white">{t('continueGoogle')}</Text>
          )}
        </Pressable>

        {error ? (
          <Text className="text-sm leading-5 text-red-400" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>

      {DEMO_MODE ? (
        <View className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
          <Text className="font-semibold text-amber-200">{t('demoMode')}</Text>
          <Text className="mt-1 text-sm leading-5 text-amber-300">
            {isEnokiConfigured && Platform.OS !== 'web'
              ? 'Real Google zkLogin runs on web for now. On this device, sign-in creates a local testnet wallet with no Google account.'
              : 'Enoki is not configured, so sign-in creates a local testnet wallet with no Google account.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
