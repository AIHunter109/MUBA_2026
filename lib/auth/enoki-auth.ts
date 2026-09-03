import type { AuthClient } from './types';

/**
 * Native placeholder. Real Enoki zkLogin runs on web only for now (see
 * enoki-config.ts). `resolveAuthClient` never selects this on native, so
 * `signIn` throwing here only guards against misconfiguration.
 */
export const enokiAuthClient: AuthClient = {
  async signIn() {
    throw new Error('Enoki zkLogin is not available on this platform yet. Use a dev build or web.');
  },
  async signOut() {
    // no-op
  },
  async getSigner() {
    throw new Error('Enoki signing is not available on this platform yet.');
  },
};
