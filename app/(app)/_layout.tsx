import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';

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

  // Android's native bottom bar allows at most 5 visible tabs.
  return (
    <NativeTabs tintColor="#60a5fa">
      <NativeTabs.Trigger name="index">
        <Label>{t('home')}</Label>
        <Icon sf="house.fill" androidSrc={<VectorIcon family={Ionicons} name="home" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="send">
        <Label>{t('send')}</Label>
        <Icon sf="paperplane.fill" androidSrc={<VectorIcon family={Ionicons} name="paper-plane" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recipients">
        <Label>{t('recipients')}</Label>
        <Icon sf="person.2.fill" androidSrc={<VectorIcon family={Ionicons} name="people" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Label>{t('history')}</Label>
        <Icon sf="clock.fill" androidSrc={<VectorIcon family={Ionicons} name="time" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>{t('settings')}</Label>
        <Icon sf="gearshape.fill" androidSrc={<VectorIcon family={Ionicons} name="settings" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="remit-plan" hidden />
    </NativeTabs>
  );
}
