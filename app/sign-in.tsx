import { Stack } from 'expo-router';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Eyebrow, Notice } from '@/components/ui';
import { Wordmark } from '@/components/wordmark';
import { useAuth } from '@/lib/auth/auth-context';
import { DEMO_MODE, isEnokiConfigured } from '@/lib/auth/enoki-config';
import { c } from '@/lib/design/tokens';
import { useLayout } from '@/lib/design/use-layout';

const POINTS = [
  {
    title: 'Keep more of what you send',
    body: 'Bank wires and transfer services take 6 to 15 percent. Stablecoins on Sui settle for cents, in seconds, to any country.',
  },
  {
    title: 'Just say what you want',
    body: '“Send Mum 150 USDC this month for school fees.” The app turns it into a payment you review and approve.',
  },
  {
    title: 'A safety check before money moves',
    body: 'Two models read the instruction for scam patterns, urgency pressure and first-time recipients. It warns, it never blocks.',
  },
];

export default function SignInScreen() {
  const { signIn, isAuthenticating, error } = useAuth();
  const insets = useSafeAreaInsets();
  const { isWide } = useLayout();

  return (
    <ScrollView
      className={`flex-1 ${c.bgPaper}`}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 32,
        width: '100%',
        maxWidth: 1180,
        alignSelf: 'center',
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Sign in', headerShown: false }} />

      <View className="flex-row items-center justify-between gap-4 pb-10">
        <Eyebrow>Cross-border payments</Eyebrow>
        <Eyebrow>Sui testnet · prototype</Eyebrow>
      </View>

      <View className="flex-1 justify-center gap-10 py-6">
        <View className="gap-7">
          <Wordmark />

          <View className="gap-5">
            <Text
              className={`${isWide ? 'text-[68px]' : 'text-[42px]'} font-medium tracking-[-2px] ${c.textInk}`}
              style={{ lineHeight: isWide ? 70 : 46 }}
            >
              Send money home,{'\n'}
              <Text className={c.textVermillion}>without the middleman.</Text>
            </Text>

            <Text className={`max-w-[54ch] text-[16px] leading-[26px] ${c.textInk2}`}>
              RemitGuard helps foreign workers and students in Malaysia send and receive family
              support across borders, as easily as sending a message.
            </Text>
          </View>

          <View className="gap-3">
            <Button
              label="Continue with Google"
              icon="logo-google"
              busy={isAuthenticating}
              onPress={() => {
                void signIn();
              }}
              className={isWide ? 'self-start px-8' : ''}
            />
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Text className={`text-[12px] leading-[19px] ${c.textInk3}`}>
              No seed phrase. Google sign-in creates a self-custodial Sui wallet for you.
            </Text>
          </View>
        </View>

        <View className={`gap-3 ${isWide ? 'flex-row' : ''}`}>
          {POINTS.map((point) => (
            <Card key={point.title} className="flex-1 gap-2">
              <Text className={`text-[14px] font-semibold ${c.textInk}`}>{point.title}</Text>
              <Text className={`text-[12.5px] leading-[20px] ${c.textInk2}`}>{point.body}</Text>
            </Card>
          ))}
        </View>

        {DEMO_MODE ? (
          <Notice tone="warn">
            {isEnokiConfigured && Platform.OS !== 'web'
              ? 'Testnet demo. Real Google sign-in runs on web; on this device it creates a local test wallet with no Google account.'
              : 'Testnet demo. Sign-in creates a local test wallet. No real money is involved.'}
          </Notice>
        ) : null}
      </View>

      <View className={`mt-8 flex-row justify-between gap-4 border-t pt-5 ${c.hairline}`}>
        <Text className={`max-w-[52ch] text-[11px] leading-[18px] ${c.textInk3}`}>
          Prototype on Sui testnet. Balances and transfers are real on-chain operations against
          test tokens with no monetary value.
        </Text>
        <Eyebrow>MUBA 2026</Eyebrow>
      </View>
    </ScrollView>
  );
}
