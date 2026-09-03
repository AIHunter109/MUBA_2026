import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as Crypto from 'expo-crypto';

import type { AuthClient, AuthSession } from './types';

const DEMO_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const DEMO_NAMES = [
  { displayName: 'Amina (Demo)', email: 'amina.demo@remitguard.test' },
  { displayName: 'Rahim (Demo)', email: 'rahim.demo@remitguard.test' },
  { displayName: 'Priya (Demo)', email: 'priya.demo@remitguard.test' },
];

/**
 * Offline sign-in used until real Enoki credentials are configured.
 *
 * Generates an ephemeral Ed25519 keypair with `expo-crypto` (works in Expo Go)
 * and derives a real Sui testnet address. No network calls, no OAuth. The
 * resulting session shape matches what the Enoki client will produce, so the
 * rest of the app does not branch on demo vs. real.
 */
export const demoAuthClient: AuthClient = {
  async signIn(): Promise<AuthSession> {
    const seed = Crypto.getRandomBytes(32);
    const keypair = Ed25519Keypair.fromSecretKey(seed);
    const walletAddress = keypair.toSuiAddress();
    const persona = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)];

    return {
      userId: `demo:${walletAddress}`,
      provider: 'demo',
      email: persona.email,
      displayName: persona.displayName,
      walletAddress,
      demoSecretKey: keypair.getSecretKey(),
      expiresAt: Date.now() + DEMO_SESSION_TTL_MS,
      isDemo: true,
    };
  },

  async signOut(): Promise<void> {
    // Nothing to revoke for a local ephemeral key.
  },

  async getSigner(session): Promise<Ed25519Keypair> {
    if (!session.demoSecretKey) {
      throw new Error('This demo session has no signing key. Sign out and sign in again.');
    }
    return Ed25519Keypair.fromSecretKey(session.demoSecretKey);
  },
};
