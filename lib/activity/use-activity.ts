import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { monthLabel } from '@/lib/format';
import { apiGet } from '@/lib/sui/api';

export type ActivityItem = {
  digest: string;
  timestampMs: number | null;
  direction: 'out' | 'self';
  counterparty: string | null;
  /** Absolute value moved, in base units of `symbol`. */
  amount: string;
  symbol: string;
  decimals: number;
  gasFeeMist: string;
  success: boolean;
};

export type MonthBucket = {
  label: string;
  /** USDC base units sent in this calendar month. */
  total: bigint;
  /** True for the month we are currently in. */
  current: boolean;
};

const MONTHS_SHOWN = 6;

/**
 * Payment history and the figures derived from it.
 *
 * Every number here is computed from `/v1/activity`, which reads the chain
 * directly - there is no local ledger to fall out of sync. The endpoint returns
 * payments SENT from this wallet, because the node only indexes transactions by
 * sender; incoming transfers would need a separate indexer.
 */
export function useActivity() {
  const { session } = useAuth();
  const owner = session?.walletAddress;

  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!owner) {
      setItems([]);
      return;
    }
    setIsRefreshing(true);
    try {
      const { activity } = await apiGet<{ activity: ActivityItem[] }>(
        `/v1/activity?owner=${encodeURIComponent(owner)}&limit=50`,
      );
      setItems(activity);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your payment history.');
    } finally {
      setIsRefreshing(false);
    }
  }, [owner]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const settled = (items ?? []).filter((item) => item.success);
    const usdcSent = settled
      .filter((item) => item.symbol === 'USDC' && item.direction === 'out')
      .reduce((sum, item) => sum + BigInt(item.amount), 0n);
    const fees = settled.reduce((sum, item) => sum + BigInt(item.gasFeeMist), 0n);
    const transfers = settled.filter((item) => item.direction === 'out').length;
    return { usdcSent, fees, transfers };
  }, [items]);

  /** The last six calendar months of USDC sent, oldest first. */
  const monthly = useMemo<MonthBucket[]>(() => {
    const now = new Date();
    const buckets: MonthBucket[] = [];

    for (let back = MONTHS_SHOWN - 1; back >= 0; back -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - back, 1);
      buckets.push({ label: monthLabel(date.getMonth()), total: 0n, current: back === 0 });
    }

    const oldest = new Date(now.getFullYear(), now.getMonth() - (MONTHS_SHOWN - 1), 1).getTime();

    for (const item of items ?? []) {
      if (!item.success || item.symbol !== 'USDC' || item.direction !== 'out' || !item.timestampMs) {
        continue;
      }
      if (item.timestampMs < oldest) {
        continue;
      }
      const date = new Date(item.timestampMs);
      const index =
        (date.getFullYear() - now.getFullYear()) * 12 +
        (date.getMonth() - now.getMonth()) +
        (MONTHS_SHOWN - 1);
      if (index >= 0 && index < buckets.length) {
        buckets[index].total += BigInt(item.amount);
      }
    }

    return buckets;
  }, [items]);

  return {
    items,
    isLoading: items === null && error === null,
    isRefreshing,
    error,
    refresh,
    stats,
    monthly,
  };
}
