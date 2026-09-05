import { Stack } from 'expo-router';

/**
 * Web-only override: no header here at all. The sidebar/bottom-bar chrome
 * from _layout.web.tsx already wraps every page (RemitPlan and Guardians are
 * linked there directly), so an extra per-page header would be redundant and
 * inconsistent with every other screen in the app.
 */
export default function SettingsStackLayoutWeb() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
