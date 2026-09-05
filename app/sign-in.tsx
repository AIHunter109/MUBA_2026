import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/translated-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth/auth-context';
import { DEMO_MODE } from '@/lib/auth/enoki-config';

type Feature = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    icon: 'trending-down-outline',
    color: '#34d399',
    title: 'Keep more of what you send',
    body: 'Bank wires and transfer services take 6 to 15 percent. Stablecoins on Sui settle for cents, in seconds, to any country.',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    color: '#60a5fa',
    title: 'Just say what you want',
    body: '"Send Mum 150 USDC this month for school fees." The app turns it into a payment you review and approve.',
  },
  {
    icon: 'shield-checkmark-outline',
    color: '#34d399',
    title: 'A safety check before money moves',
    body: 'Two AI models flag scam patterns, urgency pressure, and first-time recipients. It warns, it never blocks.',
  },
];

export default function SignInScreen() {
  const { signIn, isAuthenticating, error } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1 bg-slate-950"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 32,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Sign in', headerShown: false }} />

      <View className="w-full max-w-md gap-8">
        <View className="gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/25">
            <Text className="text-2xl font-bold text-white">R</Text>
          </View>
          <Text className="text-4xl font-bold leading-tight tracking-tight text-white">
            Send money home,{'\n'}without the middleman.
          </Text>
          <Text className="text-base leading-6 text-slate-400">
            RemitGuard helps foreign workers and students in Malaysia send and receive family support
            across borders, as easily as sending a message.
          </Text>
        </View>

        <View className="gap-4">
          {FEATURES.map((f) => (
            <View key={f.title} className="flex-row gap-3">
              <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-xl bg-slate-900">
                <Ionicons name={f.icon} size={18} color={f.color} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold text-white">{f.title}</Text>
                <Text className="text-xs leading-5 text-slate-400">{f.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className="gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            disabled={isAuthenticating}
            onPress={() => {
              void signIn();
            }}
            className="h-14 flex-row items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 shadow-lg shadow-blue-500/20 active:bg-blue-500 disabled:opacity-60"
          >
            {isAuthenticating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#ffffff" />
                <Text className="text-base font-bold text-white">Continue with Google</Text>
              </>
            )}
          </Pressable>

          {error ? (
            <Text className="text-sm leading-5 text-red-400" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <Text className="text-center text-xs leading-5 text-slate-500">
            No seed phrase. Google sign-in creates a self-custodial Sui wallet for you.
          </Text>
        </View>

        {DEMO_MODE ? (
          <View className="flex-row gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
            <Ionicons name="flask-outline" size={18} color="#fbbf24" />
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold text-amber-200">Testnet demo</Text>
              <Text className="text-xs leading-5 text-amber-300/90">
                Sign-in creates a local test wallet. No real money is involved.
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
