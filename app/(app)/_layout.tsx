import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { AppNavigation } from '@/components/app-navigation';

export default function AppLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <View className="flex-1 flex-row bg-slate-950">
      <AppNavigation />
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}
