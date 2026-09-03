import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthSession } from './types';

const SESSION_KEY = 'remitguard.auth.session';

/**
 * Web fallback: `sessionStorage` is per-tab and cleared when the tab closes.
 * This is intentional for the demo: no long-lived token sits in web storage.
 * Native uses the OS keychain/keystore via SecureStore.
 */
function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  const webStorage = getWebStorage();

  let raw: string | null = null;
  try {
    raw = webStorage
      ? webStorage.getItem(SESSION_KEY)
      : await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.walletAddress || !parsed?.userId) {
      await clearAuthSession();
      return null;
    }
    return parsed;
  } catch {
    await clearAuthSession();
    return null;
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  const raw = JSON.stringify(session);
  const webStorage = getWebStorage();

  if (webStorage) {
    webStorage.setItem(SESSION_KEY, raw);
    return;
  }

  await SecureStore.setItemAsync(SESSION_KEY, raw, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

export async function clearAuthSession(): Promise<void> {
  const webStorage = getWebStorage();

  if (webStorage) {
    webStorage.removeItem(SESSION_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(SESSION_KEY);
}
