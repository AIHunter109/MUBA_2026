import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/translated-text';

import { Screen } from '@/components/screen';

export function AppPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Screen>
      <View className="gap-1">
        <Text className="text-3xl font-bold tracking-tight text-white">{title}</Text>
        <Text className="text-sm leading-5 text-slate-400">{subtitle}</Text>
      </View>
      {children}
    </Screen>
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
