import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthTokens } from '@/lib/contracts';

/**
 * Access token: memory only (15 min TTL, re-obtained via refresh on app start).
 * Refresh token: persisted in expo-secure-store (Keychain / Keystore).
 * expo-secure-store does not support web, so on web the refresh token is memory-only too
 * (the session does not survive a page reload there).
 */

// SecureStore keys may only contain alphanumerics, '.', '-' and '_'.
const REFRESH_KEY = 'auth.refreshToken';
const useSecureStore = Platform.OS !== 'web';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshLoaded = false;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function getRefreshToken(): Promise<string | null> {
  if (refreshLoaded || !useSecureStore) return refreshToken;
  try {
    refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    refreshToken = null; // unreadable (e.g. keychain reset) — treat as signed out
  }
  refreshLoaded = true;
  return refreshToken;
}

export async function setRefreshToken(token: string): Promise<void> {
  refreshToken = token;
  refreshLoaded = true;
  if (!useSecureStore) return;
  try {
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  } catch {
    // Keep the in-memory copy so the current session still works.
  }
}

export async function setTokens(tokens: AuthTokens): Promise<void> {
  setAccessToken(tokens.accessToken);
  await setRefreshToken(tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  refreshLoaded = true;
  if (!useSecureStore) return;
  try {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch {
    // nothing else we can do
  }
}

/** Test helper: forget the in-memory cache so the next read hits SecureStore. */
export function __resetTokenCacheForTests(): void {
  accessToken = null;
  refreshToken = null;
  refreshLoaded = false;
}
