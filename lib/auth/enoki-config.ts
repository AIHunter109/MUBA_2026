export const ENOKI_NETWORK = 'testnet' as const;

export const ENOKI_API_KEY = process.env.EXPO_PUBLIC_ENOKI_API_KEY;
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

export const isEnokiConfigured = Boolean(ENOKI_API_KEY && GOOGLE_CLIENT_ID);

/** Explicit opt-out of real auth, regardless of whether credentials are present. */
const DEMO_FLAG = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

/**
 * Web uses EnokiFlow directly (enoki-auth.web.ts). Native builds its own
 * zkLogin flow from the low-level EnokiClient + Sui SDK's ZkLoginSigner
 * (enoki-auth.ts), sidestepping EnokiFlow's `crypto.subtle` dependency, which
 * Hermes does not provide - see that file for the full flow.
 *
 * Native's Google sign-in goes through `react-native-nitro-google-signin`, a
 * real native module: it is not present in Expo Go, only in a dev-client /
 * standalone build (`npx expo run:android` / `run:ios`, or an EAS dev build).
 * Running this branch inside plain Expo Go will fail to resolve that module -
 * expected, since Expo Go can never support arbitrary native modules.
 */
export const AUTH_MODE: 'demo' | 'enoki' = isEnokiConfigured && !DEMO_FLAG ? 'enoki' : 'demo';

/** True when the UI should tell the user they are on a fixture wallet. */
export const DEMO_MODE = AUTH_MODE === 'demo';
