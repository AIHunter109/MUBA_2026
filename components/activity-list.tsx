import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, Text, View } from 'react-native';

import { Divider, EmptyState } from '@/components/ui';
import type { ActivityItem } from '@/lib/activity/use-activity';
import { c, mono, palette } from '@/lib/design/tokens';
import { formatSui, formatUnits, formatWhen, shortAddress } from '@/lib/format';
import { explorerTxUrl } from '@/lib/sui/network';

function amountLabel(item: ActivityItem): string {
  const value = formatUnits(BigInt(item.amount), item.decimals, {
    minFraction: item.symbol === 'USDC' ? 2 : 0,
    maxFraction: item.symbol === 'USDC' ? 2 : 4,
  });
  return `${item.direction === 'out' ? '−' : ''}${value} ${item.symbol}`;
}

export function ActivityRow({ item, showDigest = false }: { item: ActivityItem; showDigest?: boolean }) {
  const failed = !item.success;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`View ${item.digest} on the Sui explorer`}
      onPress={() => void Linking.openURL(explorerTxUrl(item.digest))}
      className="flex-row items-center gap-3 py-4 active:opacity-60"
    >
      <View
        className={`h-9 w-9 items-center justify-center rounded-[6px] ${
          failed ? c.bgVermillionTint : c.bgStone
        }`}
      >
        <Ionicons
          name={failed ? 'close' : item.direction === 'out' ? 'arrow-up' : 'swap-horizontal'}
          size={16}
          color={failed ? palette.vermillion : palette.ink}
        />
      </View>

      <View className="flex-1 gap-0.5">
        <Text className={`text-[14px] font-medium ${c.textInk}`} numberOfLines={1}>
          {item.counterparty ? shortAddress(item.counterparty, 8, 6) : 'Wallet activity'}
        </Text>
        <Text className={`text-[12px] ${c.textInk3}`}>
          {formatWhen(item.timestampMs)}
          {failed ? ' · failed' : ''}
          {item.gasFeeMist !== '0' ? ` · ${formatSui(BigInt(item.gasFeeMist))} SUI fee` : ''}
        </Text>
        {showDigest ? (
          <Text style={[mono, { fontSize: 11 }]} className={c.textInk3} numberOfLines={1}>
            {item.digest}
          </Text>
        ) : null}
      </View>

      <Text className={`text-[14px] font-medium ${failed ? c.textInk3 : c.textInk}`}>
        {amountLabel(item)}
      </Text>
    </Pressable>
  );
}

export function ActivityList({
  items,
  showDigest = false,
  emptyTitle = 'No payments yet',
  emptyDetail = 'Payments you send appear here the moment they settle on Sui.',
}: {
  items: ActivityItem[];
  showDigest?: boolean;
  emptyTitle?: string;
  emptyDetail?: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} detail={emptyDetail} />;
  }

  return (
    <View>
      {items.map((item, index) => (
        <View key={item.digest}>
          {index > 0 ? <Divider /> : null}
          <ActivityRow item={item} showDigest={showDigest} />
        </View>
      ))}
    </View>
  );
}
