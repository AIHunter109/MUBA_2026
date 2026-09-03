import { Platform } from 'react-native';

export const ENOKI_NETWORK = 'testnet' as const;

export const ENOKI_API_KEY = process.env.EXPO_PUBLIC_ENOKI_API_KEY;
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

export const isEnokiConfigured = Boolean(ENOKI_API_KEY && GOOGLE_CLIENT_ID);

/** Explicit opt-out of real auth, regardless of whether credentials are present. */
const DEMO_FLAG = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

/**
 * Real Enoki zkLogin currently runs on web only: Google's web OAuth client
 * rejects non-http redirects (Expo Go / native), and EnokiFlow's session
 * encryption needs `crypto.subtle`, which Hermes does not provide. Native
 * falls back to the local demo wallet until a dev build lands.
 */
export const AUTH_MODE: 'demo' | 'enoki' =
  isEnokiConfigured && !DEMO_FLAG && Platform.OS === 'web' ? 'enoki' : 'demo';

/** True when the UI should tell the user they are on a fixture wallet. */
export const DEMO_MODE = AUTH_MODE === 'demo';
