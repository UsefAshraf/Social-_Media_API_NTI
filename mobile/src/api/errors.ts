import { isAxiosError } from 'axios';

import type { AppError } from '@/lib/contracts';

export const RATE_LIMIT_MESSAGE = 'Too many attempts, try again later';
export const NETWORK_ERROR_MESSAGE = 'Unable to reach the server. Check your connection and try again.';
export const TIMEOUT_MESSAGE = 'The request timed out. Please try again.';
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const STATUS_FALLBACKS: Record<number, string> = {
  400: 'The request was invalid.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You are not allowed to do that.',
  404: 'Not found.',
  409: 'That already exists.',
  422: 'The request was invalid.',
};

export function makeAppError(
  message: string,
  status: number | null = null,
  extra: Partial<Pick<AppError, 'isNetworkError' | 'isRateLimited'>> = {},
): AppError {
  return {
    status,
    message,
    isNetworkError: extra.isNetworkError ?? false,
    isRateLimited: extra.isRateLimited ?? status === 429,
  };
}

export function isAppError(e: unknown): e is AppError {
  if (typeof e !== 'object' || e === null) return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.message === 'string' &&
    typeof o.isNetworkError === 'boolean' &&
    typeof o.isRateLimited === 'boolean' &&
    (o.status === null || typeof o.status === 'number') &&
    !isAxiosError(e)
  );
}

/** Pulls a human message out of a backend error body: `{ error }` (normal / Joi) or `{ message }` (e.g. POST /auth/reset). */
function messageFromBody(body: unknown): string | null {
  // String bodies (HTML error pages, proxies) are not user-friendly; use the status fallback instead.
  if (typeof body !== 'object' || body === null) return null;
  const o = body as Record<string, unknown>;
  for (const key of ['error', 'message'] as const) {
    const v = o[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'object' && v !== null && typeof (v as { message?: unknown }).message === 'string') {
      return (v as { message: string }).message;
    }
  }
  return null;
}

/** Normalises anything thrown by the data layer into an `AppError`. Never throws. */
export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e;

  if (isAxiosError(e)) {
    const res = e.response;
    if (!res) {
      const timedOut = e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT';
      return makeAppError(timedOut ? TIMEOUT_MESSAGE : NETWORK_ERROR_MESSAGE, null, { isNetworkError: true });
    }
    const status = res.status;
    if (status === 429) return makeAppError(RATE_LIMIT_MESSAGE, 429, { isRateLimited: true });
    const fromBody = messageFromBody(res.data);
    const fallback = STATUS_FALLBACKS[status] ?? (status >= 500 ? 'Server error. Please try again later.' : GENERIC_ERROR_MESSAGE);
    return makeAppError(fromBody ?? fallback, status);
  }

  if (e instanceof Error && e.message) return makeAppError(e.message, null);
  if (typeof e === 'string' && e) return makeAppError(e, null);
  return makeAppError(GENERIC_ERROR_MESSAGE, null);
}
