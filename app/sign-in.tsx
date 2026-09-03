import { Stack } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { DEMO_MODE, isEnokiConfigured } from '@/lib/auth/enoki-config';

export default function SignInScreen() {
  const { signIn, isAuthenticating, error } = useAuth();

  return (
    <View className="flex-1 justify-center gap-8 bg-white px-6">
      <Stack.Screen options={{ title: 'Sign in', headerShown: false }} />

      <View className="gap-3">
        <Text className="text-4xl font-bold text-slate-950">RemitGuard</Text>
        <Text className="text-base leading-6 text-slate-600">
          Sign in with Google to create your self-custodial Sui wallet. You review every
          transfer before any money moves.
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
          className="flex-row items-center justify-center gap-3 rounded-xl bg-emerald-700 px-5 py-4 active:bg-emerald-800 disabled:opacity-60"
        >
          {isAuthenticating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-base font-bold text-white">Continue with Google</Text>
          )}
        </Pressable>

        {error ? (
          <Text className="text-sm leading-5 text-red-600" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>

      {DEMO_MODE ? (
        <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Text className="font-semibold text-amber-950">Demo mode</Text>
          <Text className="mt-1 text-sm leading-5 text-amber-900">
            {isEnokiConfigured && Platform.OS !== 'web'
              ? 'Real Google zkLogin runs on web for now. On this device, sign-in creates a local testnet wallet with no Google account.'
              : 'Enoki is not configured, so sign-in creates a local testnet wallet with no Google account.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
