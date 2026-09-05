import type { Signer } from '@mysten/sui/cryptography';
import type { ZkLoginSignatureInputs } from '@mysten/sui/zklogin';

export type AuthProviderId = 'demo' | 'google';

export type AuthSession = {
  /** Stable identifier for the signed-in user. */
  userId: string;
  provider: AuthProviderId;
  email: string;
  displayName: string;
  /** Sui address controlled by this session. */
  walletAddress: string;
  /**
   * Bech32 (`suiprivkey1...`) secret key. Present only for demo sessions on
   * testnet, where the client holds an ephemeral key so it can sign directly.
   */
  demoSecretKey?: string;
  /**
   * Native zkLogin signing material (see lib/auth/enoki-auth.ts). The web flow
   * (enoki-auth.web.ts) uses EnokiFlow's own encrypted session store instead
   * and never populates this - native builds EnokiClient + ZkLoginSigner
   * directly, so the ephemeral key and proof have to live in the session to
   * reconstruct a signer later. The ephemeral key alone cannot forge a
   * transfer without the proof, and both expire at `maxEpoch`.
   */
  zkLogin?: {
    ephemeralSecretKey: string;
    maxEpoch: number;
    inputs: ZkLoginSignatureInputs;
  };
  /** Backend access token for authenticated API calls. Absent in pure demo mode. */
  accessToken?: string;
  /** Epoch millis. The session is treated as expired once passed. */
  expiresAt?: number;
  isDemo: boolean;
};

/** Thrown when the user backs out of the sign-in flow (closes the OAuth window). */
export class AuthCancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled.');
    this.name = 'AuthCancelledError';
  }
}

export interface AuthClient {
  /** Runs the provider-specific sign-in and returns a persisted-ready session. */
  signIn(): Promise<AuthSession>;
  /** Provider-specific cleanup (revoke tokens, etc). Local session clearing is separate. */
  signOut(session: AuthSession): Promise<void>;
  /** Returns a signer for the session's wallet so the client can submit a transaction. */
  getSigner(session: AuthSession): Promise<Signer>;
}
