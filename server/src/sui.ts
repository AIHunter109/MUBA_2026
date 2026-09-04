import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { coinWithBalance, Transaction } from '@mysten/sui/transactions';
import { fromBase64, isValidSuiAddress, toBase64 } from '@mysten/sui/utils';

import type { Environment } from './config';

const DEFAULT_TESTNET_RPC_URL = 'https://fullnode.testnet.sui.io:443';

const SUI_COIN_TYPE = '0x2::sui::SUI';

/** Circle native USDC on Sui testnet, unless overridden by SUI_USDC_TYPE. */
const DEFAULT_USDC_TYPE =
  '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC';

export type SupportedCoin = { type: string; symbol: string; decimals: number };

export function supportedCoins(environment: Environment): SupportedCoin[] {
  return [
    { type: environment.SUI_USDC_TYPE || DEFAULT_USDC_TYPE, symbol: 'USDC', decimals: 6 },
    { type: SUI_COIN_TYPE, symbol: 'SUI', decimals: 9 },
  ];
}

export function createSuiClient(environment: Environment): SuiGrpcClient {
  return new SuiGrpcClient({
    network: environment.SUI_NETWORK,
    baseUrl: environment.SUI_RPC_URL || DEFAULT_TESTNET_RPC_URL,
  });
}

export type CoinBalance = { coinType: string; symbol: string; decimals: number; balance: string };

export type ReceivedTransfer = {
  digest: string;
  sender: string | null;
  amountBaseUnits: string;
  coinType: string;
  symbol: string;
  decimals: number;
  occurredAt: string;
};

export async function getBalances(
  client: SuiGrpcClient,
  environment: Environment,
  owner: string,
): Promise<CoinBalance[]> {
  if (!isValidSuiAddress(owner)) {
    throw new Error('Invalid Sui address');
  }

  const coins = supportedCoins(environment);
  const results = await Promise.all(
    coins.map(async (coin) => {
      const { balance } = await client.getBalance({ owner, coinType: coin.type });
      return {
        coinType: coin.type,
        symbol: coin.symbol,
        decimals: coin.decimals,
        balance: balance.balance,
      };
    }),
  );

  return results;
}

/**
 * The gRPC transaction list currently filters by sender only. The testnet JSON-RPC
 * index exposes the recipient filter we need to surface payments received outside
 * this app, while all transaction execution continues to use the gRPC client.
 */
export async function getReceivedTransfers(
  environment: Environment,
  owner: string,
): Promise<ReceivedTransfer[]> {
  if (!isValidSuiAddress(owner)) {
    throw new Error('Invalid Sui address');
  }

  const rpc = new SuiJsonRpcClient({
    network: environment.SUI_NETWORK,
    url: environment.SUI_RPC_URL || DEFAULT_TESTNET_RPC_URL,
  });
  const coins = supportedCoins(environment);
  const coinByType = new Map(coins.map((coin) => [coin.type, coin]));
  const response = await rpc.queryTransactionBlocks({
    filter: { ToAddress: owner },
    options: { showBalanceChanges: true, showInput: true },
    limit: 50,
    order: 'descending',
  });

  return response.data.flatMap((transaction) => {
    const sender = transaction.transaction?.data.sender ?? null;
    const occurredAt = transaction.timestampMs
      ? new Date(Number(transaction.timestampMs)).toISOString()
      : new Date().toISOString();

    return (transaction.balanceChanges ?? []).flatMap((change) => {
      const coin = coinByType.get(change.coinType);
      if (!coin || BigInt(change.amount) <= 0n || !isAddressOwner(change.owner, owner)) {
        return [];
      }

      return [{
        digest: transaction.digest,
        sender,
        amountBaseUnits: change.amount,
        coinType: coin.type,
        symbol: coin.symbol,
        decimals: coin.decimals,
        occurredAt,
      }];
    });
  });
}

function isAddressOwner(owner: unknown, address: string): boolean {
  return (
    typeof owner === 'object' &&
    owner !== null &&
    'AddressOwner' in owner &&
    typeof owner.AddressOwner === 'string' &&
    owner.AddressOwner.toLowerCase() === address.toLowerCase()
  );
}

export type PrepareTransferInput = {
  sender: string;
  recipient: string;
  amountBaseUnits: bigint;
  coinType: string;
};

/** Builds an unsigned transfer PTB and returns its BCS bytes for the client to sign. */
export async function prepareTransfer(
  client: SuiGrpcClient,
  input: PrepareTransferInput,
): Promise<{ transactionBytes: string }> {
  if (!isValidSuiAddress(input.sender) || !isValidSuiAddress(input.recipient)) {
    throw new Error('Invalid Sui address');
  }
  if (input.sender === input.recipient) {
    throw new Error('Recipient must be a different address');
  }
  if (input.amountBaseUnits <= 0n) {
    throw new Error('Amount must be greater than zero');
  }

  const tx = new Transaction();
  tx.setSender(input.sender);
  tx.transferObjects(
    [coinWithBalance({ type: input.coinType, balance: input.amountBaseUnits })],
    input.recipient,
  );

  const transactionBytes = await tx.build({ client });
  return { transactionBytes: toBase64(transactionBytes) };
}

export type ExecuteTransferInput = { transactionBytes: string; signature: string };
export type ExecuteTransferResult = { digest: string; status: 'success' | 'failure'; error?: string };

export async function executeSignedTransfer(
  client: SuiGrpcClient,
  input: ExecuteTransferInput,
): Promise<ExecuteTransferResult> {
  const transaction = fromBase64(input.transactionBytes);

  const executed = await client.core.executeTransaction({
    transaction,
    signatures: [input.signature],
    include: { effects: true },
  });

  const digest =
    executed.$kind === 'Transaction' ? executed.Transaction.digest : executed.FailedTransaction.digest;

  const settled = await client.core.waitForTransaction({ digest, include: { effects: true } });
  const result = settled.$kind === 'Transaction' ? settled.Transaction : settled.FailedTransaction;

  return {
    digest,
    status: result.status.success ? 'success' : 'failure',
    error: result.status.success ? undefined : describeStatusError(result.status.error),
  };
}

function describeStatusError(error: unknown): string {
  if (!error) {
    return 'Transaction failed on chain.';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return JSON.stringify(error);
}
