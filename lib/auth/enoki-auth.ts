import { EnokiClient } from '@mysten/enoki';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import { ZkLoginSigner } from '@mysten/sui/zklogin';
import { GoogleOneTapSignIn } from 'react-native-nitro-google-signin';

import { ENOKI_API_KEY, ENOKI_NETWORK, GOOGLE_CLIENT_ID } from './enoki-config';
import { AuthCancelledError, type AuthClient, type AuthSession } from './types';

/**
 * Real Google zkLogin on native, built from the low-level `EnokiClient`
 * (plain HTTPS calls, no `crypto.subtle`) plus the Sui SDK's own
 * `ZkLoginSigner` - not `EnokiFlow`, which the web flow uses and which
 * Hermes cannot run (see enoki-config.ts).
 *
 * Flow: generate an ephemeral keypair -> ask Enoki for a nonce bound to its
 * public key -> run native Google Sign-In with that nonce embedded in the ID
 * token -> hand the resulting JWT back to Enoki for the zkLogin proof and the
 * derived Sui address -> wrap the ephemeral signer in a ZkLoginSigner using
 * that proof. Every step after the nonce is verifiable against what Enoki
 * itself issued; nothing here fabricates trust.
 */

let enokiClientSingleton: EnokiClient | null = null;

function getEnokiClient(): EnokiClient {
  if (!ENOKI_API_KEY) {
    throw new Error('EXPO_PUBLIC_ENOKI_API_KEY is not set.');
  }
  enokiClientSingleton ??= new EnokiClient({ apiKey: ENOKI_API_KEY });
  return enokiClientSingleton;
}

type GoogleJwtClaims = { email?: string; name?: string; sub?: string };

/** Decodes the (unverified) claims out of a JWT payload for display purposes
 * only - the address and proof come from Enoki, which independently verifies
 * the token; this is never used as a trust boundary. */
function decodeJwtClaims(jwt: string): GoogleJwtClaims {
  try {
    const payload = jwt.split('.')[1] ?? '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = new TextDecoder().decode(fromBase64(padded));
    return JSON.parse(json) as GoogleJwtClaims;
  } catch {
    return {};
  }
}

export const enokiAuthClient: AuthClient = {
  async signIn(): Promise<AuthSession> {
    if (!ENOKI_API_KEY || !GOOGLE_CLIENT_ID) {
      throw new Error('Enoki is not configured. Set EXPO_PUBLIC_ENOKI_API_KEY and EXPO_PUBLIC_GOOGLE_CLIENT_ID.');
    }
    const client = getEnokiClient();

    // A fresh ephemeral keypair every sign-in - it only ever signs on behalf
    // of this one session, and both it and the proof expire at maxEpoch.
    const ephemeralKeypair = new Ed25519Keypair();

    const { nonce, randomness, maxEpoch, estimatedExpiration } = await client.createZkLoginNonce({
      network: ENOKI_NETWORK,
      ephemeralPublicKey: ephemeralKeypair.getPublicKey(),
    });

    GoogleOneTapSignIn.configure({ webClientId: GOOGLE_CLIENT_ID, nonce });

    let result;
    try {
      // The explicit "Sign in with Google" UI, matching our own button press -
      // signIn()'s low-friction One Tap path is meant for a silent auto-prompt
      // on launch, not a deliberate user-initiated sign-in.
      result = await GoogleOneTapSignIn.presentExplicitSignIn();
    } catch {
      throw new AuthCancelledError();
    }
    if (result.type !== 'success' || !result.data) {
      throw new AuthCancelledError();
    }

    const jwt = result.data.idToken;

    const [zkp, zkLogin] = await Promise.all([
      client.createZkLoginZkp({
        network: ENOKI_NETWORK,
        jwt,
        ephemeralPublicKey: ephemeralKeypair.getPublicKey(),
        randomness,
        maxEpoch,
      }),
      client.getZkLogin({ jwt }),
    ]);

    const claims = decodeJwtClaims(jwt);

    return {
      userId: claims.sub ? `google:${claims.sub}` : `google:${zkLogin.address}`,
      provider: 'google',
      email: claims.email ?? result.data.user.email ?? '',
      displayName: claims.name ?? result.data.user.name ?? result.data.user.email ?? 'Google account',
      walletAddress: zkLogin.address,
      zkLogin: {
        ephemeralSecretKey: ephemeralKeypair.getSecretKey(),
        maxEpoch,
        inputs: zkp,
      },
      expiresAt: estimatedExpiration,
      isDemo: false,
    };
  },

  async signOut(): Promise<void> {
    try {
      await GoogleOneTapSignIn.signOut();
    } catch {
      // Best-effort; local session clearing happens separately in auth-context.
    }
  },

  async getSigner(session: AuthSession) {
    if (!session.zkLogin) {
      throw new Error('This session has no zkLogin signing material. Sign out and sign in again.');
    }
    const ephemeralSigner = Ed25519Keypair.fromSecretKey(session.zkLogin.ephemeralSecretKey);
    return new ZkLoginSigner({
      ephemeralSigner,
      maxEpoch: session.zkLogin.maxEpoch,
      inputs: session.zkLogin.inputs,
      legacyAddress: false,
      address: session.walletAddress,
    });
  },
};
