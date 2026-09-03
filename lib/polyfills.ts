import * as Crypto from 'expo-crypto';

/**
 * Minimal Web Crypto shim for React Native / Expo Go.
 *
 * `@mysten/sui` (keypair generation, transaction building, zkLogin nonce) expects
 * `globalThis.crypto.getRandomValues`. Hermes does not provide it reliably, so we
 * back it with `expo-crypto`, which is bundled in Expo Go.
 *
 * Import this module once, before any `@mysten/sui` code runs (see app/_layout.tsx).
 */
type MutableCrypto = { getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T };

const existing = (globalThis as { crypto?: MutableCrypto }).crypto;

if (!existing) {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    enumerable: false,
    value: { getRandomValues: Crypto.getRandomValues },
  });
} else if (typeof existing.getRandomValues !== 'function') {
  existing.getRandomValues = Crypto.getRandomValues as MutableCrypto['getRandomValues'];
}
