import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { Signer } from '@mysten/sui/cryptography';

import { demoAuthClient } from './demo-auth';
import { enokiAuthClient } from './enoki-auth';
import { AUTH_MODE } from './enoki-config';
import { clearAuthSession, loadAuthSession, saveAuthSession } from './session-store';
import type { AuthClient, AuthSession } from './types';

function resolveAuthClient(): AuthClient {
  // AUTH_MODE is 'enoki' only on web with credentials present and demo mode off
  // (see lib/auth/enoki-config.ts). Native always uses the local demo wallet.
  return AUTH_MODE === 'enoki' ? enokiAuthClient : demoAuthClient;
}

type AuthContextValue = {
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getSigner: () => Promise<Signer>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isExpired(session: AuthSession): boolean {
  return typeof session.expiresAt === 'number' && session.expiresAt <= Date.now();
}

export function AuthProvider({ children }: PropsWithChildren) {
  const client = useMemo(resolveAuthClient, []);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const existing = await loadAuthSession();
        if (!active) {
          return;
        }
        if (existing && isExpired(existing)) {
          await clearAuthSession();
          setSession(null);
        } else {
          setSession(existing);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const next = await client.signIn();
      await saveAuthSession(next);
      setSession(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, [client]);

  const signOut = useCallback(async () => {
    const current = session;
    setSession(null);
    setError(null);
    try {
      if (current) {
        await client.signOut(current);
      }
    } finally {
      await clearAuthSession();
    }
  }, [client, session]);

  const getSigner = useCallback(async () => {
    if (!session) {
      throw new Error('You are not signed in.');
    }
    return client.getSigner(session);
  }, [client, session]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, isLoading, isAuthenticating, error, signIn, signOut, getSigner }),
    [session, isLoading, isAuthenticating, error, signIn, signOut, getSigner],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
