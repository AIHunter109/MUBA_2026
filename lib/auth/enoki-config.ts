export const ENOKI_NETWORK = 'testnet' as const;

export const ENOKI_API_KEY = process.env.EXPO_PUBLIC_ENOKI_API_KEY;
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

/** Explicit opt-in to fixture auth, or the implicit state when Enoki is not configured. */
export const DEMO_MODE =
  process.env.EXPO_PUBLIC_DEMO_MODE === 'true' || !(ENOKI_API_KEY && GOOGLE_CLIENT_ID);

export const isEnokiConfigured = Boolean(ENOKI_API_KEY && GOOGLE_CLIENT_ID);

/** Which auth client the app should use at runtime. */
export const AUTH_MODE: 'demo' | 'enoki' = DEMO_MODE || !isEnokiConfigured ? 'demo' : 'enoki';
