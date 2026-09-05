import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { isValidSuiAddress, normalizeStructTag, normalizeSuiAddress } from '@mysten/sui/utils';

import type { Environment } from './config';
import { supportedCoins } from './sui';

/**
 * Payment history, read straight off the chain. Nothing is written or cached -
 * every figure the app shows is re-derived from ledger state on request, so the
 * history cannot drift from what actually settled.
 *
 * Scope note: the node indexes transactions by SENDER only. `listTransactions`
 * takes a `sender` or a Move `function` predicate and nothing else, and the
 * public JSON-RPC and GraphQL transports that once offered a recipient filter
 * are both switched off. So this endpoint returns payments SENT from an address.
 * Incoming transfers would need an external indexer.
 */

export type ActivityItem = {
  digest: string;
  /** Epoch millis, or null for a transaction the node has not checkpointed yet. */
  timestampMs: number | null;
  /** 'out' for a payment to someone else, 'self' when only gas moved. */
  direction: 'out' | 'self';
  counterparty: string | null;
  /** Absolute value moved, in the coin's base units. */
  amount: string;
  symbol: string;
  decimals: number;
  /** Gas this transaction burned, in MIST. */
  gasFeeMist: string;
  success: boolean;
};

type BalanceChange = { coinType: string; address: string; amount: string };

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/**
 * The node returns fully-expanded type tags and addresses
 * (`0x0000...0002::sui::SUI`), while config carries the human short form
 * (`0x2::sui::SUI`). Every comparison below normalises both sides first -
 * comparing the raw strings silently matches nothing, which reads as "this
 * transaction moved no money" rather than as an error.
 */
function sameCoin(a: string, b: string): boolean {
  try {
    return normalizeStructTag(a) === normalizeStructTag(b);
  } catch {
    return a === b;
  }
}

function sameAddress(a: string, b: string): boolean {
  try {
    return normalizeSuiAddress(a) === normalizeSuiAddress(b);
  } catch {
    return a === b;
  }
}

/**
 * Reduce one transaction to the single line an activity feed should show: which
 * coin moved, how much, and who received it.
 *
 * A transaction usually touches two coins - the one being sent, and the SUI burnt
 * for gas. Adding the gas back onto the sender's SUI change isolates the amount
 * they actually intended to move, so a USDC payment is not reported as a tiny SUI
 * outflow.
 */
function summarise(
  owner: string,
  transaction: {
    digest: string;
    timestampMs: number | null;
    status: { success: boolean };
    balanceChanges: BalanceChange[] | undefined;
    effects:
      | { gasUsed: { computationCost: string; storageCost: string; storageRebate: string } }
      | undefined;
  },
  coins: { type: string; symbol: string; decimals: number }[],
): ActivityItem | null {
  const changes = transaction.balanceChanges ?? [];
  const gas = transaction.effects?.gasUsed;
  const gasFee = gas
    ? BigInt(gas.computationCost) + BigInt(gas.storageCost) - BigInt(gas.storageRebate)
    : 0n;

  const moved = coins
    .map((coin) => {
      const net = changes
        .filter((change) => sameAddress(change.address, owner) && sameCoin(change.coinType, coin.type))
        .reduce((sum, change) => sum + BigInt(change.amount), 0n);
      return { coin, net: coin.symbol === 'SUI' ? net + gasFee : net };
    })
    .filter((entry) => entry.net !== 0n)
    .sort((a, b) => (abs(b.net) > abs(a.net) ? 1 : -1))[0];

  if (!moved) {
    // Gas-only transaction: still worth showing, since it did cost the user money.
    return gasFee > 0n
      ? {
          digest: transaction.digest,
          timestampMs: transaction.timestampMs,
          direction: 'self',
          counterparty: null,
          amount: '0',
          symbol: 'SUI',
          decimals: 9,
          gasFeeMist: gasFee.toString(),
          success: transaction.status.success,
        }
      : null;
  }

  const counterparty =
    changes.find(
      (change) =>
        sameCoin(change.coinType, moved.coin.type) &&
        !sameAddress(change.address, owner) &&
        BigInt(change.amount) > 0n,
    )?.address ?? null;

  return {
    digest: transaction.digest,
    timestampMs: transaction.timestampMs,
    direction: counterparty ? 'out' : 'self',
    counterparty,
    amount: abs(moved.net).toString(),
    symbol: moved.coin.symbol,
    decimals: moved.coin.decimals,
    gasFeeMist: gasFee.toString(),
    success: transaction.status.success,
  };
}

export async function getActivity(
  client: SuiGrpcClient,
  environment: Environment,
  owner: string,
  limit = 40,
): Promise<ActivityItem[]> {
  if (!isValidSuiAddress(owner)) {
    throw new Error('Invalid Sui address');
  }

  const page = await client.listTransactions({
    filter: { sender: owner },
    include: { balanceChanges: true, effects: true },
    order: 'descending',
    limit,
  });

  const coins = supportedCoins(environment);
  const items: ActivityItem[] = [];

  for (const result of page.transactions) {
    const transaction = result.Transaction ?? result.FailedTransaction;
    if (!transaction) {
      continue;
    }
    const item = summarise(owner, transaction, coins);
    if (item) {
      items.push(item);
    }
  }

  return items.sort((a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0));
}
