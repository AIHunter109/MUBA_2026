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
   * Real Enoki zkLogin sessions never expose signing material to the client.
   */
  demoSecretKey?: string;
  /** Backend access token for authenticated API calls. Absent in pure demo mode. */
  accessToken?: string;
  /** Epoch millis. The session is treated as expired once passed. */
  expiresAt?: number;
  isDemo: boolean;
};

export interface AuthClient {
  /** Runs the provider-specific sign-in and returns a persisted-ready session. */
  signIn(): Promise<AuthSession>;
  /** Provider-specific cleanup (revoke tokens, etc). Local session clearing is separate. */
  signOut(session: AuthSession): Promise<void>;
}
