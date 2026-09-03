import { Platform } from 'react-native';

export const SUI_NETWORK = 'testnet' as const;
export const SUI_TESTNET_RPC_URL = 'https://fullnode.testnet.sui.io:443';
export const SUI_TESTNET_EXPLORER_URL = 'https://suiscan.xyz/testnet/tx';

export function explorerTxUrl(digest: string): string {
  return `${SUI_TESTNET_EXPLORER_URL}/${digest}`;
}

export function getApiUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
}
