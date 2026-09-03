import type { ReactNode } from 'react';
import { ScrollView, type ScrollViewProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  gap?: number;
  refreshControl?: ScrollViewProps['refreshControl'];
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
};

const MAX_CONTENT_WIDTH = 1120;

/**
 * Standard page frame: dark background, horizontal padding, and top padding that
 * clears the status bar / notch. Content is capped and centered so wide web
 * viewports do not stretch it edge to edge. The bottom tab bar / sidebar handle
 * their own safe area.
 */
export function Screen({
  children,
  scroll = true,
  gap = 20,
  refreshControl,
  keyboardShouldPersistTaps,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const containerStyle = {
    paddingTop: insets.top + 12,
    paddingBottom: 44,
    paddingHorizontal: 20,
    gap,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  } as const;

  if (!scroll) {
    return (
      <View className="flex-1 bg-slate-950" style={{ flex: 1, ...containerStyle }}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-950"
      contentContainerStyle={containerStyle}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={refreshControl}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    >
      {children}
    </ScrollView>
  );
}
