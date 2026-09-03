import { SuiGrpcClient } from '@mysten/sui/grpc';
import { isValidSuiAddress } from '@mysten/sui/utils';
import type { Environment } from './config';

const DEFAULT_TESTNET_RPC_URL = 'https://fullnode.testnet.sui.io:443';

export function createSuiClient(environment: Environment): SuiGrpcClient {
  return new SuiGrpcClient({
    network: environment.SUI_NETWORK,
    baseUrl: environment.SUI_RPC_URL || DEFAULT_TESTNET_RPC_URL,
  });
}

export async function getTokenBalance(
  client: SuiGrpcClient,
  owner: string,
  coinType?: string,
): Promise<{ owner: string; coinType: string; balance: string }> {
  if (!isValidSuiAddress(owner)) {
    throw new Error('Invalid Sui address');
  }

  const result = await client.getBalance({ owner, coinType });

  return {
    owner,
    coinType: result.balance.coinType,
    balance: result.balance.balance,
  };
}
