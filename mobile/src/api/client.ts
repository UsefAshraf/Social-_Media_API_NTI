import axios, { AxiosHeaders, isAxiosError } from 'axios';
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

import { API_BASE } from '@/lib/config';
import type { AuthTokens } from '@/lib/contracts';

import { makeAppError, toAppError } from './errors';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokenStorage';

/** Backend success envelope. */
export interface ApiEnvelope<T> {
  success: true;
  data: T;
  message?: string;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

// ---- session-expired hook (registered by the auth store; avoids a circular import) ----

let sessionExpiredHandler: (() => void) | null = null;

export function setOnSessionExpired(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

async function expireSession(): Promise<void> {
  await clearTokens();
  try {
    sessionExpiredHandler?.();
  } catch {
    // a faulty handler must not break the request pipeline
  }
}

// ---- endpoints that must never trigger a refresh ----

const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

function pathOf(url: string | undefined): string {
  if (!url) return '';
  const noQuery = url.split('?')[0];
  // strip absolute base if a full URL was used
  const idx = noQuery.indexOf('/api/v2');
  return idx >= 0 ? noQuery.slice(idx + '/api/v2'.length) : noQuery;
}

export function isNoRefreshEndpoint(url: string | undefined): boolean {
  const p = pathOf(url).replace(/\/+$/, '');
  return NO_REFRESH_PATHS.some((np) => p === np || p.endsWith(np));
}

// ---- single-flight refresh ----

let refreshInFlight: Promise<string> | null = null;

/**
 * Exchanges the stored refresh token for a new token pair and returns the new access token.
 * Single-flight: concurrent callers share one network request, because the backend rotates
 * refresh tokens (a second concurrent refresh would use an already-invalidated token).
 *
 * If the server rejects the refresh token (400/401/403) or there is no refresh token, tokens are
 * cleared and the session-expired handler fires. Transient failures (network, 429, 5xx) reject
 * with an AppError but keep the stored session.
 */
export function refreshSession(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await expireSession();
    throw makeAppError('Your session has expired. Please sign in again.', 401);
  }
  try {
    const res = await api.post<ApiEnvelope<AuthTokens>>('/auth/refresh', { refreshToken });
    const tokens = res.data.data;
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      throw makeAppError('Invalid refresh response from server.', res.status);
    }
    await setTokens(tokens);
    return tokens.accessToken;
  } catch (e) {
    const err = toAppError(e);
    if (err.status === 400 || err.status === 401 || err.status === 403) {
      await expireSession();
    }
    throw err;
  }
}

// ---- interceptors ----

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !isNoRefreshEndpoint(config.url)) {
    const headers = AxiosHeaders.from(config.headers);
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!isAxiosError(error) || error.response?.status !== 401 || !error.config) {
      throw error;
    }
    const config = error.config as RetriableConfig;
    if (config._retry || isNoRefreshEndpoint(config.url)) throw error;
    config._retry = true;

    const sentAuth = AxiosHeaders.from(config.headers).get('Authorization');
    const current = getAccessToken();
    let newToken: string;
    if (current && sentAuth !== `Bearer ${current}`) {
      // Another request already refreshed while this one was in flight — just retry.
      newToken = current;
    } else {
      newToken = await refreshSession(); // throws AppError on failure
    }

    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${newToken}`);
    config.headers = headers;
    return api.request(config);
  },
);

// ---- helpers: unwrap `{ data }` and throw AppError ----

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const res = await api.request<ApiEnvelope<T>>(config);
    return res.data?.data as T;
  } catch (e) {
    throw toAppError(e);
  }
}

export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'GET', url }),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'POST', url, data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'PUT', url, data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'PATCH', url, data }),
  delete: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'DELETE', url }),
};
