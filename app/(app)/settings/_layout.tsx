import { Stack } from 'expo-router';

const BACKGROUND = '#020617';

const SUB_SCREEN_OPTIONS = {
  headerShown: true,
  headerStyle: { backgroundColor: BACKGROUND },
  headerTintColor: '#f1f5f9',
  headerShadowVisible: false,
} as const;

/**
 * Native only (see _layout.web.tsx for the web override): RemitPlan,
 * Guardians, and Payment policies don't get their own tab - Android/iOS
 * bottom bars cap out around 5 items - so they're nested Stack screens
 * reached from the Settings tab instead, each with a native back button.
 */
export default function SettingsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BACKGROUND } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="remit-plan" options={{ ...SUB_SCREEN_OPTIONS, title: 'RemitPlan' }} />
      <Stack.Screen name="guardians" options={{ ...SUB_SCREEN_OPTIONS, title: 'Guardians' }} />
      <Stack.Screen name="payment-policies" options={{ ...SUB_SCREEN_OPTIONS, title: 'Payment policies' }} />
    </Stack>
  );
}
