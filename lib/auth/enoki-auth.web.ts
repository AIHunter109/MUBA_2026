import { EnokiFlow } from '@mysten/enoki';
import * as WebBrowser from 'expo-web-browser';

import { ENOKI_API_KEY, ENOKI_NETWORK, GOOGLE_CLIENT_ID } from './enoki-config';
import { AuthCancelledError, type AuthClient, type AuthSession as Session } from './types';

WebBrowser.maybeCompleteAuthSession();

let flowSingleton: EnokiFlow | null = null;

function getFlow(): EnokiFlow {
  if (!ENOKI_API_KEY) {
    throw new Error('EXPO_PUBLIC_ENOKI_API_KEY is not set.');
  }
  flowSingleton ??= new EnokiFlow({ apiKey: ENOKI_API_KEY });
  return flowSingleton;
}

function getRedirectUrl(): string {
  // Must be registered verbatim as an Authorized redirect URI on the Google
  // OAuth web client, e.g. http://localhost:8081/sign-in in web dev.
  return `${window.location.origin}/sign-in`;
}

type GoogleJwtClaims = { email?: string; name?: string; sub?: string };

function decodeJwtClaims(jwt: string): GoogleJwtClaims {
  try {
    const payload = jwt.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(normalized) : '';
    return json ? (JSON.parse(json) as GoogleJwtClaims) : {};
  } catch {
    return {};
  }
}

export const enokiAuthClient: AuthClient = {
  async signIn(): Promise<Session> {
    if (!ENOKI_API_KEY || !GOOGLE_CLIENT_ID) {
      throw new Error('Enoki is not configured. Set EXPO_PUBLIC_ENOKI_API_KEY and EXPO_PUBLIC_GOOGLE_CLIENT_ID.');
    }

    const flow = getFlow();
    const redirectUrl = getRedirectUrl();

    if (__DEV__) {
      // Register this exact string as an Authorized redirect URI on the Google client.
      console.log('[enoki] redirect_uri =', redirectUrl);
    }

    const authUrl = await flow.createAuthorizationURL({
      provider: 'google',
      clientId: GOOGLE_CLIENT_ID,
      redirectUrl,
      network: ENOKI_NETWORK,
      extraParams: { scope: ['email', 'profile'] },
    });

    let result: Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>;
    try {
      result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    } catch {
      // Popup blocked or closed before it could report a result.
      throw new AuthCancelledError();
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new AuthCancelledError();
    }
    if (result.type !== 'success' || !result.url) {
      throw new AuthCancelledError();
    }

    const hashIndex = result.url.indexOf('#');
    const hash = hashIndex >= 0 ? result.url.slice(hashIndex + 1) : '';
    if (!hash) {
      // Reached the redirect with no token (e.g. user denied the consent screen).
      throw new AuthCancelledError();
    }

    await flow.handleAuthCallback(hash);

    const address = flow.$zkLoginState.get().address;
    if (!address) {
      throw new Error('Enoki did not return a wallet address.');
    }

    const zkSession = await flow.getSession();
    const claims = zkSession?.jwt ? decodeJwtClaims(zkSession.jwt) : {};

    return {
      userId: claims.sub ? `google:${claims.sub}` : `google:${address}`,
      provider: 'google',
      email: claims.email ?? '',
      displayName: claims.name ?? claims.email ?? 'Google account',
      walletAddress: address,
      expiresAt: zkSession?.expiresAt,
      isDemo: false,
    };
  },

  async signOut(): Promise<void> {
    try {
      await getFlow().logout();
    } catch {
      // Session may already be gone; local clearing happens in auth-context.
    }
  },

  async getSigner() {
    // Rebuilds the zkLogin signer from the flow's stored session (ephemeral key
    // + proof). Throws if the session has expired, prompting a fresh sign-in.
    return getFlow().getKeypair({ network: ENOKI_NETWORK });
  },
};
