import * as Crypto from 'expo-crypto';

/**
 * Minimal Web Crypto shim for React Native / Expo Go.
 *
 * `@mysten/sui` (keypair generation, transaction building, zkLogin nonce) expects
 * `globalThis.crypto.getRandomValues`. Hermes does not provide it reliably, so we
 * back it with `expo-crypto`, which is bundled in Expo Go.
 *
 * `@mysten/enoki`'s low-level `EnokiClient` (native zkLogin, see
 * lib/auth/enoki-auth.ts) also calls `crypto.randomUUID()` on every request, for
 * a `Request-Id` header - also missing on Hermes, also backed by `expo-crypto`.
 *
 * Import this module once, before any `@mysten/sui` or `@mysten/enoki` code runs
 * (see app/_layout.tsx).
 */
type MutableCrypto = {
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
  randomUUID?: () => string;
};

const existing = (globalThis as { crypto?: MutableCrypto }).crypto;

if (!existing) {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    enumerable: false,
    value: { getRandomValues: Crypto.getRandomValues, randomUUID: Crypto.randomUUID },
  });
} else {
  if (typeof existing.getRandomValues !== 'function') {
    existing.getRandomValues = Crypto.getRandomValues as MutableCrypto['getRandomValues'];
  }
  if (typeof existing.randomUUID !== 'function') {
    existing.randomUUID = Crypto.randomUUID;
  }
}
