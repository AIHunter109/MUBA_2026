import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps, useWindowDimensions, View } from 'react-native';
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
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 360 ? 14 : width >= 768 ? 28 : 20;

  const containerStyle = {
    paddingTop: insets.top + 12,
    paddingBottom: Math.max(insets.bottom + 16, 44),
    paddingHorizontal: horizontalPadding,
    gap,
    width: '100%',
    minWidth: 0,
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
    // Long forms (e.g. Budget Planner) have TextInputs stacked well below the fold -
    // without this, the keyboard can cover a focused field with no way to scroll it
    // into view on Android, and iOS gets no avoidance at all. "padding" on iOS only,
    // matching the convention already used in send-chat.tsx: Android is left to its
    // default windowSoftInputMode="adjustResize" behavior rather than double-applying
    // avoidance on top of it.
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
      <ScrollView
        className="flex-1 bg-slate-950"
        contentContainerStyle={containerStyle}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={refreshControl}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? 'handled'}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
