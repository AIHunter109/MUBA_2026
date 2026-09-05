import { Text, View } from 'react-native';

import { c, palette } from '@/lib/design/tokens';
import { formatUnits } from '@/lib/format';
import type { MonthBucket } from '@/lib/activity/use-activity';

const CHART_HEIGHT = 168;
const USDC_DECIMALS = 6;

/**
 * Six months of outgoing USDC, drawn with plain views - no chart library, so it
 * renders identically on iOS, Android and web.
 *
 * Colour does one job here: every settled month is ink, and the month you are
 * currently in is vermillion, because that is the only bar still moving.
 */
export function MonthlyChart({ months }: { months: MonthBucket[] }) {
  const peak = months.reduce((max, month) => (month.total > max ? month.total : max), 0n);
  const hasData = peak > 0n;

  // Round the axis up to something legible rather than to the exact peak.
  const ceiling = hasData ? peak : 0n;

  return (
    <View className="gap-4">
      <View className="flex-row items-baseline justify-between">
        <Text className={`text-[15px] font-semibold ${c.textInk}`}>Sent per month</Text>
        <Text className={`text-[12px] ${c.textInk3}`}>USDC · last six months</Text>
      </View>

      <View className="flex-row gap-3">
        {/* Axis */}
        <View className="justify-between py-1" style={{ height: CHART_HEIGHT }}>
          <Text className={`text-[11px] ${c.textInk3}`}>
            {hasData ? formatUnits(ceiling, USDC_DECIMALS, { minFraction: 0, maxFraction: 0 }) : '100'}
          </Text>
          <Text className={`text-[11px] ${c.textInk3}`}>
            {hasData
              ? formatUnits(ceiling / 2n, USDC_DECIMALS, { minFraction: 0, maxFraction: 0 })
              : '50'}
          </Text>
          <Text className={`text-[11px] ${c.textInk3}`}>0</Text>
        </View>

        <View className="flex-1">
          <View style={{ height: CHART_HEIGHT }} className="justify-between">
            <View className="h-px w-full bg-[#EAE8E1]" />
            <View className="h-px w-full bg-[#EAE8E1]" />
            <View className="h-px w-full bg-[#DCD9D0]" />
          </View>

          {/* Bars sit on the baseline, overlaying the gridlines. */}
          <View
            className="absolute bottom-0 left-0 right-0 flex-row items-end justify-between gap-2"
            style={{ height: CHART_HEIGHT }}
          >
            {months.map((month) => {
              const ratio = hasData ? Number((month.total * 1000n) / peak) / 1000 : 0;
              // Anything non-zero keeps a visible stub so a small month is not invisible.
              const height = month.total > 0n ? Math.max(ratio * (CHART_HEIGHT - 24), 4) : 0;
              return (
                <View key={month.label} className="flex-1 items-center justify-end gap-2">
                  {month.total > 0n ? (
                    <Text
                      className="text-[11px] font-medium"
                      style={{ color: month.current ? palette.vermillion : palette.ink2 }}
                    >
                      {formatUnits(month.total, USDC_DECIMALS, { minFraction: 0, maxFraction: 0 })}
                    </Text>
                  ) : null}
                  <View
                    accessibilityLabel={`${month.label}: ${formatUnits(month.total, USDC_DECIMALS)} USDC`}
                    style={{
                      height,
                      backgroundColor: month.current ? palette.vermillion : palette.ink,
                      width: '58%',
                      maxWidth: 34,
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View className="flex-row gap-3">
        <View className="w-6" />
        <View className="flex-1 flex-row justify-between gap-2">
          {months.map((month) => (
            <Text
              key={month.label}
              className={`flex-1 text-center text-[12px] ${month.current ? c.textInk : c.textInk3}`}
            >
              {month.label}
            </Text>
          ))}
        </View>
      </View>

      {!hasData ? (
        <Text className={`text-[12px] leading-[19px] ${c.textInk3}`}>
          No USDC has left this wallet in the last six months. The chart fills in as payments
          settle.
        </Text>
      ) : null}
    </View>
  );
}
