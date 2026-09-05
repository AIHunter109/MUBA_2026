import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function AppLayout() {
  const { session, isLoading } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  // Android/iOS bottom bars cap out around 5 items, so RemitPlan, Guardians,
  // and Payment policies aren't tabs here - they're reached from the
  // Settings tab instead (see app/(app)/settings/_layout.tsx). The web
  // sidebar/bottom-bar has room to link to them directly - see _layout.web.tsx.
  return (
    <NativeTabs tintColor="#60a5fa">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="home" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="send">
        <NativeTabs.Trigger.Label>{t('send')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="paperplane.fill" src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="paper-plane" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recipients">
        <NativeTabs.Trigger.Label>{t('recipients')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2.fill" src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="people" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>{t('history')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.fill" src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="time" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t('settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="settings" />} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
