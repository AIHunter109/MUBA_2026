import { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';

import { ActivityList } from '@/components/activity-list';
import { Screen } from '@/components/screen';
import { Card, Notice, SectionHeading, Stat, Subtitle, Title } from '@/components/ui';
import { useActivity } from '@/lib/activity/use-activity';
import { c, palette } from '@/lib/design/tokens';
import { formatSui, formatUsd } from '@/lib/format';

export default function HistoryScreen() {
  const { items, isLoading, isRefreshing, error, refresh, stats } = useActivity();

  const onRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={palette.ink3} />
      }
    >
      <View className="max-w-[860px] gap-6">
        <View className="gap-2">
          <Title>Payment history</Title>
          <Subtitle>
            Every payment sent from this wallet, read straight from Sui. Tap a row to open its
            on-chain receipt.
          </Subtitle>
        </View>

        <View className="flex-row flex-wrap gap-3">
          <Stat label="Sent" value={formatUsd(stats.usdcSent)} hint="USDC, all time" />
          <Stat label="Transfers" value={String(stats.transfers)} hint="Settled payments" />
          <Stat label="Fees paid" value={`${formatSui(stats.fees)} SUI`} hint="Network gas" />
        </View>

        {error ? <Notice tone="warn">{error}</Notice> : null}

        <View className="gap-1">
          <SectionHeading title="All payments" />
          {isLoading ? (
            <View className="py-10">
              <ActivityIndicator color={palette.ink3} />
            </View>
          ) : (
            <ActivityList
              items={items ?? []}
              showDigest
              emptyTitle="No payments yet"
              emptyDetail="Once you send your first transfer, it appears here with its Sui transaction digest."
            />
          )}
        </View>

        <Card tone="sunken" className="gap-2">
          <Text className={`text-[13px] font-semibold ${c.textInk}`}>What this list covers</Text>
          <Text className={`text-[12.5px] leading-[20px] ${c.textInk2}`}>
            Sui indexes transactions by sender, so this is the record of money leaving this wallet.
            Incoming transfers still change your balance — they just need a separate indexer before
            they can be listed here.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
