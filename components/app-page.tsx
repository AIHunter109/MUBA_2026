import { Stack, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';

export function AppPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <View className="flex-1 bg-slate-950">
      <Stack.Screen
        options={{
          title,
          headerShown: true,
          headerStyle: { backgroundColor: '#020617' },
          headerTintColor: '#f8fafc',
          headerTitleStyle: { color: '#f8fafc' },
        }}
      />
      <View className="flex-1 gap-5 px-5 py-8">
        <View className="gap-1">
          <Text className="text-3xl font-bold tracking-tight text-white">{title}</Text>
          <Text className="text-sm leading-5 text-slate-400">{subtitle}</Text>
        </View>
        {children}
        <Pressable
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
          className="items-center rounded-xl border border-slate-700 px-5 py-4 active:bg-slate-800"
        >
          <Text className="font-semibold text-slate-300">Back to home</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function PlaceholderCard({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: string;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <Text className="text-base font-semibold text-white">{title}</Text>
      <Text className="text-sm leading-5 text-slate-400">{detail}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => undefined}
          className="self-start rounded-lg border border-blue-400/30 bg-blue-400/10 px-4 py-2.5"
        >
          <Text className="text-sm font-semibold text-blue-300">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
