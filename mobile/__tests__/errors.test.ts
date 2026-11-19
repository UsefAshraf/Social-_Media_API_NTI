/// <reference types="jest" />
jest.mock('expo-secure-store', () => require('@/api/__testutils__/secureStoreMock').secureStoreMock);

import { api, http } from '@/api/client';
import {
  GENERIC_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  RATE_LIMIT_MESSAGE,
  TIMEOUT_MESSAGE,
  makeAppError,
  toAppError,
} from '@/api/errors';
import { fakeServer } from '@/api/__testutils__/fakeServer';
import type { Reply } from '@/api/__testutils__/fakeServer';

async function errorFor(reply: Reply) {
  api.defaults.adapter = fakeServer(() => reply).adapter;
  try {
    await http.post('/auth/login', {});
  } catch (e) {
    return e;
  }
  throw new Error('expected a rejection');
}

describe('toAppError', () => {
  it('uses the backend `error` field', async () => {
    expect(await errorFor({ status: 400, data: { success: false, error: 'Email is required' } })).toEqual({
      status: 400,
      message: 'Email is required',
      isNetworkError: false,
      isRateLimited: false,
    });
  });

  it('falls back to the `message` field (POST /auth/reset failures)', async () => {
    expect(await errorFor({ status: 400, data: { success: false, message: 'Token expired' } })).toMatchObject({
      status: 400,
      message: 'Token expired',
    });
  });

  it('maps 429 to a friendly rate-limit message', async () => {
    expect(
      await errorFor({ status: 429, data: { success: false, error: 'Too many requests from this IP' } }),
    ).toEqual({ status: 429, message: RATE_LIMIT_MESSAGE, isNetworkError: false, isRateLimited: true });
    expect(await errorFor({ status: 429, data: 'Too Many Requests' })).toMatchObject({ isRateLimited: true });
  });

  it('keeps 403 (banned) messages from the server', async () => {
    expect(await errorFor({ status: 403, data: { success: false, error: 'Account is banned' } })).toMatchObject({
      status: 403,
      message: 'Account is banned',
    });
  });

  it('uses status fallbacks for empty / non-JSON bodies', async () => {
    expect(await errorFor({ status: 500, data: '<html>oops</html>' })).toMatchObject({
      status: 500,
      message: 'Server error. Please try again later.',
    });
    expect(await errorFor({ status: 418 })).toMatchObject({ status: 418, message: GENERIC_ERROR_MESSAGE });
  });

  it('flags network errors and timeouts', async () => {
    expect(await errorFor('network')).toEqual({
      status: null,
      message: NETWORK_ERROR_MESSAGE,
      isNetworkError: true,
      isRateLimited: false,
    });
    expect(await errorFor('timeout')).toMatchObject({ message: TIMEOUT_MESSAGE, isNetworkError: true });
  });

  it('handles non-axios values', () => {
    expect(toAppError(new Error('boom'))).toMatchObject({ status: null, message: 'boom' });
    expect(toAppError(undefined)).toMatchObject({ message: GENERIC_ERROR_MESSAGE });
    expect(toAppError('plain')).toMatchObject({ message: 'plain' });
    const existing = makeAppError('already', 409);
    expect(toAppError(existing)).toBe(existing);
  });
});
