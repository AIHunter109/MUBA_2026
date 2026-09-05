import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Subtitle, Title } from '@/components/ui';
import { c } from '@/lib/design/tokens';

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
      <View className="gap-2">
        <Title>{title}</Title>
        <Subtitle>{subtitle}</Subtitle>
      </View>
      {children}
    </Screen>
  );
}

/**
 * A section that is designed but not yet wired up. It says so plainly rather
 * than pretending - a disabled control is more honest than one that silently
 * does nothing.
 */
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
    <Card className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className={`text-[15px] font-semibold ${c.textInk}`}>{title}</Text>
        <Text className={`text-[10px] font-medium uppercase tracking-[1px] ${c.textInk3}`}>
          Not built yet
        </Text>
      </View>
      <Text className={`text-[13px] leading-[20px] ${c.textInk2}`}>{detail}</Text>
      {action ? <Button label={action} variant="secondary" disabled className="self-start" /> : null}
    </Card>
  );
}
