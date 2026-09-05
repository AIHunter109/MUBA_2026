import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, RefreshControl, Text, View } from 'react-native';

import { ActivityList } from '@/components/activity-list';
import { BalanceCard } from '@/components/balance-card';
import { MonthlyChart } from '@/components/monthly-chart';
import { Screen } from '@/components/screen';
import {
  ActionTile,
  Button,
  Card,
  InlineLink,
  Notice,
  SectionHeading,
  Sheet,
  Stat,
} from '@/components/ui';
import { Wordmark } from '@/components/wordmark';
import { useActivity } from '@/lib/activity/use-activity';
import { useAuth } from '@/lib/auth/auth-context';
import { copyOrShare, copyVerb } from '@/lib/design/share-text';
import { c, mono, palette } from '@/lib/design/tokens';
import { useLayout } from '@/lib/design/use-layout';
import { formatSui, formatUsd } from '@/lib/format';
import { apiGet } from '@/lib/sui/api';
import { SUI_COIN, SUPPORTED_COINS, USDC_COIN } from '@/lib/sui/coins';
import { WEB_FAUCET_URL } from '@/lib/sui/faucet';

type BalanceRow = { coinType: string; symbol: string; decimals: number; balance: string };

export default function HomeScreen() {
  const { session } = useAuth();
  const { hasSideNav, isWide } = useLayout();
  const router = useRouter();

  const [balances, setBalances] = useState<BalanceRow[] | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const address = session?.walletAddress;
  const activity = useActivity();

  const refresh = useCallback(async () => {
    if (!address) {
      return;
    }
    setIsRefreshing(true);
    try {
      const { balances: rows } = await apiGet<{ balances: BalanceRow[] }>(
        `/v1/balances?owner=${encodeURIComponent(address)}`,
      );
      setBalances(rows);
      setBalanceError(null);
    } catch (error) {
      setBalanceError(
        error instanceof Error ? error.message : 'Could not load balances. Pull to retry.',
      );
    } finally {
      setIsRefreshing(false);
    }
    await activity.refresh();
  }, [address, activity]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      // Refetching on every focus keeps the balance honest without a socket.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address]),
  );

  const copyAddress = useCallback(async () => {
    if (!address) {
      return;
    }
    try {
      const verb = await copyOrShare(address, 'My Sui address');
      setCopyNotice(verb === 'copied' ? 'Address copied.' : 'Address shared.');
    } catch (error) {
      setCopyNotice(error instanceof Error ? error.message : 'Could not copy the address.');
    }
  }, [address]);

  if (!session) {
    return null;
  }

  const find = (symbol: string) => {
    const coin = SUPPORTED_COINS.find((entry) => entry.symbol === symbol);
    const row = balances?.find((entry) => entry.symbol === symbol);
    if (!coin) {
      return null;
    }
    return row ? BigInt(row.balance) : balances ? 0n : null;
  };

  const usdc = find(USDC_COIN.symbol);
  const sui = find(SUI_COIN.symbol);
  const recent = (activity.items ?? []).slice(0, 5);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={palette.ink3} />
      }
    >
      <View className="gap-4">
        <View className="flex-row items-center justify-between gap-4">
          {hasSideNav ? <View /> : <Wordmark />}
          <View className="flex-row items-center gap-4">
            <View className="items-end gap-0.5">
              <Text className={`text-[10px] font-medium uppercase tracking-[1px] ${c.textInk3}`}>
                Welcome back
              </Text>
              <Text className={`text-[14px] font-semibold ${c.textInk}`} numberOfLines={1}>
                {session.displayName}
              </Text>
            </View>
            {hasSideNav ? (
              <Button
                label="Account"
                variant="secondary"
                onPress={() => router.push('/(app)/settings')}
              />
            ) : null}
          </View>
        </View>
        <View className="h-px w-full bg-[#111110]" />
      </View>

      {balanceError ? <Notice tone="warn">{balanceError}</Notice> : null}
      {copyNotice ? <Notice tone="info">{copyNotice}</Notice> : null}

      <View className={`gap-6 ${isWide ? 'flex-row items-start' : ''}`}>
        {/* Left: the wallet itself. */}
        <View className={`gap-4 ${isWide ? 'w-[380px]' : 'w-full'}`}>
          <BalanceCard
            holderName={session.displayName}
            address={session.walletAddress}
            usdc={usdc}
            sui={sui}
            loading={balances === null && !balanceError}
            onCopyAddress={() => void copyAddress()}
          />

          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className={`text-[12.5px] ${c.textInk2}`}>
              {copyVerb} the address, then claim testnet SUI.
            </Text>
            <InlineLink
              label="Open the faucet"
              external
              onPress={() => void Linking.openURL(WEB_FAUCET_URL)}
            />
          </View>

          <View className="flex-row gap-2">
            <ActionTile icon="arrow-up" label="Send" primary onPress={() => router.push('/(app)/send')} />
            <ActionTile icon="arrow-down" label="Receive" onPress={() => setReceiveOpen(true)} />
            <ActionTile
              icon="people-outline"
              label="Recipients"
              onPress={() => router.push('/(app)/recipients')}
            />
            <ActionTile
              icon="receipt-outline"
              label="History"
              onPress={() => router.push('/(app)/history')}
            />
          </View>
        </View>

        {/* Right: what the wallet has been doing. */}
        <View className="flex-1 gap-6">
          <View className="flex-row flex-wrap gap-3">
            <Stat label="Sent" value={formatUsd(activity.stats.usdcSent)} hint="USDC, all time" />
            <Stat
              label="Transfers"
              value={String(activity.stats.transfers)}
              hint="Settled payments"
            />
            <Stat
              label="Fees paid"
              value={`${formatSui(activity.stats.fees)} SUI`}
              hint="Network gas"
            />
          </View>

          <Card>
            <MonthlyChart months={activity.monthly} />
          </Card>
        </View>
      </View>

      <View className="gap-1">
        <SectionHeading
          title="Activity"
          action={{ label: 'View all', onPress: () => router.push('/(app)/history') }}
        />
        {activity.error ? (
          <View className="pt-4">
            <Notice tone="warn">{activity.error}</Notice>
          </View>
        ) : (
          <ActivityList items={recent} />
        )}
      </View>

      {session.isDemo ? (
        <Notice tone="info">
          Demo session. This wallet was generated locally on this device and is not linked to a
          Google account.
        </Notice>
      ) : null}

      <Sheet visible={receiveOpen} title="Receive USDC" onClose={() => setReceiveOpen(false)}>
        <Text className={`text-[13px] leading-[20px] ${c.textInk2}`}>
          Anyone can send USDC or SUI to this address on Sui testnet.
        </Text>
        <View className={`rounded-[8px] border p-3 ${c.hairline} ${c.bgWhite}`}>
          <Text style={[mono, { fontSize: 12 }]} className={c.textInk} selectable>
            {session.walletAddress}
          </Text>
        </View>
        <Button
          label={`${copyVerb} address`}
          icon="copy-outline"
          onPress={() => {
            void copyAddress();
            setReceiveOpen(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}
