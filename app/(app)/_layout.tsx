import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';

import { useAuth } from '@/lib/auth/auth-context';

export default function AppLayout() {
  const { session, isLoading } = useAuth();

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
        <Label>Home</Label>
        <Icon sf="house.fill" androidSrc={<VectorIcon family={Ionicons} name="home" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="send">
        <Label>Send</Label>
        <Icon sf="paperplane.fill" androidSrc={<VectorIcon family={Ionicons} name="paper-plane" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recipients">
        <Label>Recipients</Label>
        <Icon sf="person.2.fill" androidSrc={<VectorIcon family={Ionicons} name="people" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Label>History</Label>
        <Icon sf="clock.fill" androidSrc={<VectorIcon family={Ionicons} name="time" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        <Icon sf="gearshape.fill" androidSrc={<VectorIcon family={Ionicons} name="settings" />} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
