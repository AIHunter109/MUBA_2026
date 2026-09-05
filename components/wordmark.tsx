import { Text, View } from 'react-native';

import { c } from '@/lib/design/tokens';

/**
 * The name, a hairline, and what it runs on. Two parts separated by a rule -
 * the same rhythm on every screen, at two sizes.
 */
export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const large = size === 'md';
  return (
    <View className="flex-row items-center gap-3">
      <Text
        className={`${large ? 'text-[20px]' : 'text-[16px]'} font-medium tracking-[1px] ${c.textInk}`}
      >
        REMITGUARD
      </Text>
      <View className={`${large ? 'h-5' : 'h-4'} w-px bg-[#DCD9D0]`} />
      <Text className={`text-[11px] font-medium uppercase tracking-[1px] ${c.textInk3}`}>
        on Sui
      </Text>
    </View>
  );
}
