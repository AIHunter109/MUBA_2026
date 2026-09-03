import { SuiGrpcClient } from '@mysten/sui/grpc';

import { SUI_NETWORK, SUI_TESTNET_RPC_URL } from './network';

/**
 * JSON-RPC has been turned off on Sui public fullnodes. The current transports
 * are gRPC and GraphQL; gRPC-web works from the browser (the testnet fullnode
 * sends permissive CORS) and from React Native via fetch.
 *
 * Use `getSuiClient().core.*` for reads and transaction submission.
 */
let client: SuiGrpcClient | null = null;

export function getSuiClient(): SuiGrpcClient {
  client ??= new SuiGrpcClient({ network: SUI_NETWORK, baseUrl: SUI_TESTNET_RPC_URL });
  return client;
}
