import { Text, View } from 'react-native';

import { Badge, Button } from '@/components/ui';
import { c } from '@/lib/design/tokens';
import { formatSui, formatUsd, shortAddress } from '@/lib/format';
import { copyVerb } from '@/lib/design/share-text';

/** The little embossed chip, the one piece of ornament the design allows itself. */
function Chip() {
  return (
    <View className="h-7 w-9 justify-center gap-1 rounded-[4px] border border-[#5C4700]/25 bg-[#5C4700]/10 px-1.5">
      <View className="h-px w-full bg-[#5C4700]/40" />
      <View className="h-px w-full bg-[#5C4700]/40" />
    </View>
  );
}

export function BalanceCard({
  holderName,
  address,
  usdc,
  sui,
  loading,
  onCopyAddress,
}: {
  holderName: string;
  address: string;
  /** USDC balance in base units, or null while it is still loading. */
  usdc: bigint | null;
  /** SUI balance in base units, or null while it is still loading. */
  sui: bigint | null;
  loading: boolean;
  onCopyAddress: () => void;
}) {
  return (
    <View className={`gap-5 rounded-[10px] p-5 ${c.bgSaffron}`}>
      <View className="flex-row items-start justify-between">
        <Text className={`text-[11px] font-medium uppercase tracking-[1px] ${c.textSaffronMid}`}>
          Remitguard
        </Text>
        <Badge label="Live" tone="live" />
      </View>

      <Chip />

      <View className="gap-1">
        <Text className={`text-[46px] font-medium leading-[1] tracking-[-1.5px] ${c.textSaffronDeep}`}>
          {usdc === null ? (loading ? '—' : '$0.00') : formatUsd(usdc)}
        </Text>
        <Text className={`text-[14px] ${c.textSaffronMid}`}>
          {sui === null ? 'SUI for gas' : `${formatSui(sui)} SUI for gas`}
        </Text>
      </View>

      <View className="h-px w-full bg-[#5C4700]/25" />

      <View className="flex-row items-end justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text className={`text-[11px] font-medium uppercase tracking-[1px] ${c.textSaffronMid}`}>
            Your Sui address
          </Text>
          <Text className={`text-[14px] font-medium ${c.textSaffronDeep}`} selectable>
            {shortAddress(address, 10, 8)}
          </Text>
        </View>
        <Button label={copyVerb} icon="copy-outline" variant="secondary" onPress={onCopyAddress} />
      </View>

      <View className="flex-row items-center justify-between">
        <Text
          className={`text-[11px] font-medium uppercase tracking-[1px] ${c.textSaffronMid}`}
          numberOfLines={1}
        >
          {holderName}
        </Text>
        <Text className={`text-[11px] font-medium uppercase tracking-[1px] ${c.textSaffronMid}`}>
          Sui Testnet
        </Text>
      </View>
    </View>
  );
}
