import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { normalizeStructTag, normalizeSuiAddress } from '@mysten/sui/utils';

import type { Environment } from '../config';
import { supportedCoins } from '../sui';

export type OnChainReceivedTransfer = {
  digest: string;
  from: string;
  amount: string;
  asset: 'USDC' | 'SUI';
  occurredAt: string;
};

const OBJECTS_PER_COIN = 25;
const MAX_DIGESTS_TO_INSPECT = 20;

function fromBaseUnitsToDecimalString(amount: bigint, decimals: number): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const fraction = (abs % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  const result = fraction ? `${whole}.${fraction}` : whole.toString();
  return negative ? `-${result}` : result;
}

/**
 * Best-effort detection of incoming transfers by tracing coin objects this
 * address currently owns back to the transaction that produced them.
 *
 * Sui's transaction-query API has no "sent to this address" filter (gRPC and
 * GraphQL both only support filtering by sender or by the Move function
 * called - confirmed directly against the SDK's TransactionFilter type and
 * against a live testnet call, not assumed), and a plain coin transfer emits
 * no Move event either. Reconstructing from owned objects is the only way to
 * see the other side of a transfer without standing up a real indexer - but
 * it has a real, honest limit: it only sees transfers whose resulting coin is
 * still owned, unspent, and unmerged. A received coin that has since been
 * spent or merged into another loses its trail back to the original
 * transfer. This covers the common case (money that arrived and is still
 * sitting in the wallet) but is not a complete history.
 *
 * Every failure here is swallowed and degrades to an empty list - a history
 * screen must still show the app's own recorded transactions even when a
 * chain read fails or times out.
 */
export async function listOnChainReceivedTransfers(
  client: SuiGrpcClient,
  environment: Environment,
  owner: string,
): Promise<OnChainReceivedTransfer[]> {
  const normalizedOwner = normalizeSuiAddress(owner);
  const coins = supportedCoins(environment).map((coin) => ({ ...coin, normalizedType: normalizeStructTag(coin.type) }));

  const coinByDigest = new Map<string, (typeof coins)[number]>();
  await Promise.all(
    coins.map(async (coin) => {
      try {
        const { objects } = await client.listOwnedObjects({
          owner: normalizedOwner,
          type: `0x2::coin::Coin<${coin.type}>`,
          limit: OBJECTS_PER_COIN,
          include: { previousTransaction: true },
        });
        for (const obj of objects) {
          if (obj.previousTransaction && !coinByDigest.has(obj.previousTransaction)) {
            coinByDigest.set(obj.previousTransaction, coin);
          }
        }
      } catch {
        // One coin type's listing failing must not block the others.
      }
    }),
  );

  const digests = [...coinByDigest.keys()].slice(0, MAX_DIGESTS_TO_INSPECT);

  const results = await Promise.all(
    digests.map(async (digest): Promise<OnChainReceivedTransfer | null> => {
      try {
        const result = await client.getTransaction({ digest, include: { balanceChanges: true, transaction: true } });
        if (result.$kind !== 'Transaction') {
          return null; // only settled, successful transfers count as "received"
        }
        const tx = result.Transaction;
        const sender = tx.transaction?.sender ? normalizeSuiAddress(tx.transaction.sender) : null;
        if (!sender || sender === normalizedOwner) {
          return null; // exclude self-originated transactions (change coins, gas rebates)
        }

        const coin = coinByDigest.get(digest);
        if (!coin) {
          return null;
        }
        const gain = (tx.balanceChanges ?? []).find(
          (change) =>
            normalizeStructTag(change.coinType) === coin.normalizedType &&
            normalizeSuiAddress(change.address) === normalizedOwner &&
            BigInt(change.amount) > 0n,
        );
        if (!gain) {
          return null;
        }

        return {
          digest,
          from: sender,
          amount: fromBaseUnitsToDecimalString(BigInt(gain.amount), coin.decimals),
          asset: coin.symbol as 'USDC' | 'SUI',
          occurredAt: tx.timestampMs ? new Date(tx.timestampMs).toISOString() : new Date().toISOString(),
        };
      } catch {
        return null;
      }
    }),
  );

  return results.filter((r): r is OnChainReceivedTransfer => r !== null);
}
