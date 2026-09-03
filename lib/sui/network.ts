import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const SUI_NETWORK = 'testnet' as const;
export const SUI_TESTNET_EXPLORER_URL = 'https://suiscan.xyz/testnet/tx';

export function explorerTxUrl(digest: string): string {
  return `${SUI_TESTNET_EXPLORER_URL}/${digest}`;
}

/**
 * Base URL for the RemitGuard API.
 *
 * On a physical device in Expo Go, `localhost` points at the phone, not the dev
 * machine, so we reuse the host Expo Go already connected to (the Metro server)
 * and swap the port. Set EXPO_PUBLIC_API_URL to override (e.g. a staging URL).
 */
export function getApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  const configuredIsLocalhost = configured?.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);

  if (configured && !(Platform.OS !== 'web' && configuredIsLocalhost)) {
    return configured;
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:3000';
  }

  const host = Constants.expoConfig?.hostUri?.split(':')[0];

  // Android emulator: the host machine is 10.0.2.2, not localhost.
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  }

  return `http://${host}:3000`;
}
