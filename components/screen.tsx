import type { ReactNode } from 'react';
import { ScrollView, type ScrollViewProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '@/lib/design/use-layout';
import { c } from '@/lib/design/tokens';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  gap?: number;
  refreshControl?: ScrollViewProps['refreshControl'];
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
};

const MAX_CONTENT_WIDTH = 1180;

/**
 * Standard page frame: paper ground, one measure, centred. Content is capped so a
 * wide desktop window reads as a document rather than a stretched app, and the
 * top inset clears the notch on a device. Navigation - top bar on wide web,
 * tab bar everywhere else - supplies its own spacing.
 */
export function Screen({
  children,
  scroll = true,
  gap = 24,
  refreshControl,
  keyboardShouldPersistTaps,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { hasSideNav } = useLayout();

  const containerStyle = {
    paddingTop: hasSideNav ? 28 : insets.top + 16,
    paddingBottom: 56,
    paddingHorizontal: hasSideNav ? 32 : 20,
    gap,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  } as const;

  if (!scroll) {
    return (
      <View className={`flex-1 ${c.bgPaper}`} style={{ flex: 1, ...containerStyle }}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      className={`flex-1 ${c.bgPaper}`}
      contentContainerStyle={containerStyle}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={refreshControl}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    >
      {children}
    </ScrollView>
  );
}
