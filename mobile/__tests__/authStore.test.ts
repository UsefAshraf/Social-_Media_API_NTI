/// <reference types="jest" />
jest.mock('expo-secure-store', () => require('@/api/__testutils__/secureStoreMock').secureStoreMock);

import { api } from '@/api/client';
import { authHeader, body, fail, fakeServer, ok, pathOf } from '@/api/__testutils__/fakeServer';
import type { Handler } from '@/api/__testutils__/fakeServer';
import { mockSecureStoreData } from '@/api/__testutils__/secureStoreMock';
import { __resetTokenCacheForTests, getAccessToken } from '@/api/tokenStorage';
import { requestPasswordReset, resetPassword, useAuth, verifyEmail } from '@/auth';

const REFRESH_KEY = 'auth.refreshToken';

const profileDoc = {
  _id: '665f1c2e9b1d4a0012345678',
  username: 'alice',
  email: 'alice@example.com',
  avatar: null,
  bio: 'hi',
  emailVerified: true,
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function serve(handler: Handler) {
  const server = fakeServer(handler);
  api.defaults.adapter = server.adapter;
  return server;
}

beforeEach(() => {
  mockSecureStoreData.clear();
  __resetTokenCacheForTests();
  useAuth.setState({ status: 'loading', user: null });
});

describe('bootstrap', () => {
  it('starts in loading', () => {
    expect(useAuth.getState().status).toBe('loading');
  });

  it('no stored refresh token → signedOut without network', async () => {
    const server = serve(() => ok({}));
    await useAuth.getState().bootstrap();
    expect(useAuth.getState()).toMatchObject({ status: 'signedOut', user: null });
    expect(server.calls).toHaveLength(0);
  });

  it('valid refresh token → refresh → getMe → signedIn with mapped user', async () => {
    mockSecureStoreData.set(REFRESH_KEY, 'stored-refresh');
    const server = serve((config) => {
      switch (pathOf(config)) {
        case '/auth/refresh':
          expect(body(config)).toEqual({ refreshToken: 'stored-refresh' });
          return ok({ accessToken: 'acc', refreshToken: 'rotated' });
        case '/users/profile':
          return authHeader(config) === 'Bearer acc' ? ok(profileDoc) : fail(401);
        default:
          return fail(404);
      }
    });
    await useAuth.getState().bootstrap();
    expect(useAuth.getState().status).toBe('signedIn');
    expect(useAuth.getState().user).toEqual({
      id: '665f1c2e9b1d4a0012345678',
      username: 'alice',
      email: 'alice@example.com',
      avatar: null,
      bio: 'hi',
      emailVerified: true,
    });
    expect(server.callsTo('/auth/refresh')).toHaveLength(1);
    expect(mockSecureStoreData.get(REFRESH_KEY)).toBe('rotated');
  });

  it('rejected refresh token → signedOut, tokens cleared, never throws', async () => {
    mockSecureStoreData.set(REFRESH_KEY, 'revoked');
    serve(() => fail(401, 'Invalid refresh token'));
    await expect(useAuth.getState().bootstrap()).resolves.toBeUndefined();
    expect(useAuth.getState().status).toBe('signedOut');
    expect(mockSecureStoreData.has(REFRESH_KEY)).toBe(false);
  });

  it('offline → signedOut but keeps the refresh token for a later retry', async () => {
    mockSecureStoreData.set(REFRESH_KEY, 'stored-refresh');
    serve(() => 'network');
    await useAuth.getState().bootstrap();
    expect(useAuth.getState().status).toBe('signedOut');
    expect(mockSecureStoreData.get(REFRESH_KEY)).toBe('stored-refresh');
  });
});

describe('login / register / logout', () => {
  const authData = {
    user: { id: 'u1', username: 'bob', email: 'bob@example.com', avatar: null, emailVerified: false },
    accessToken: 'acc',
    refreshToken: 'ref',
  };

  it('login stores tokens and signs in', async () => {
    serve((config) => (pathOf(config) === '/auth/login' ? ok(authData) : fail(404)));
    await useAuth.getState().login('bob@example.com', 'secret1');
    expect(useAuth.getState()).toMatchObject({ status: 'signedIn', user: { id: 'u1', emailVerified: false } });
    expect(getAccessToken()).toBe('acc');
    expect(mockSecureStoreData.get(REFRESH_KEY)).toBe('ref');
  });

  it('login failure throws AppError (banned → 403) and stays signedOut', async () => {
    useAuth.setState({ status: 'signedOut' });
    serve(() => fail(403, 'Your account has been banned'));
    await expect(useAuth.getState().login('x@y.z', 'p')).rejects.toEqual({
      status: 403,
      message: 'Your account has been banned',
      isNetworkError: false,
      isRateLimited: false,
    });
    expect(useAuth.getState().status).toBe('signedOut');
  });

  it('register signs in', async () => {
    const server = serve(() => ({ status: 201, data: { success: true, data: authData } }));
    await useAuth.getState().register('bob', 'bob@example.com', 'secret1');
    expect(useAuth.getState().status).toBe('signedIn');
    expect(body(server.calls[0])).toEqual({ username: 'bob', email: 'bob@example.com', password: 'secret1' });
  });

  it('logout always clears locally even when the server fails', async () => {
    serve((config) => (pathOf(config) === '/auth/login' ? ok(authData) : 'network'));
    await useAuth.getState().login('bob@example.com', 'secret1');
    await useAuth.getState().logout();
    expect(useAuth.getState()).toMatchObject({ status: 'signedOut', user: null });
    expect(getAccessToken()).toBeNull();
    expect(mockSecureStoreData.has(REFRESH_KEY)).toBe(false);
  });

  it('session expiry during use signs the store out', async () => {
    serve((config) => {
      if (pathOf(config) === '/auth/login') return ok(authData);
      if (pathOf(config) === '/auth/refresh') return fail(401, 'Invalid refresh token');
      return fail(401);
    });
    await useAuth.getState().login('bob@example.com', 'secret1');
    await expect(useAuth.getState().refreshUser()).rejects.toMatchObject({ status: 401 });
    expect(useAuth.getState()).toMatchObject({ status: 'signedOut', user: null });
  });

  it('refreshUser updates the user', async () => {
    useAuth.setState({ status: 'signedIn', user: { id: 'x', username: 'a', email: 'e', emailVerified: false } });
    serve(() => ok(profileDoc));
    await useAuth.getState().refreshUser();
    expect(useAuth.getState().user).toMatchObject({ id: profileDoc._id, emailVerified: true });
  });
});

describe('account helpers', () => {
  it('requestPasswordReset sends the email as a query param', async () => {
    const server = serve(() => ok(null));
    await requestPasswordReset(' a@b.co ');
    expect(server.calls[0].method).toBe('get');
    expect(server.calls[0].params).toEqual({ email: 'a@b.co' });
  });

  it('resetPassword surfaces the `{ message }` error shape', async () => {
    serve(() => ({ status: 400, data: { success: false, message: 'Invalid or expired token' } }));
    await expect(resetPassword('t', 'newpass1')).rejects.toMatchObject({
      status: 400,
      message: 'Invalid or expired token',
    });
  });

  it('verifyEmail rejects malformed tokens without a request', async () => {
    const server = serve(() => ok(null));
    await expect(verifyEmail('nothex')).rejects.toMatchObject({ status: 400 });
    expect(server.calls).toHaveLength(0);
    await verifyEmail('a'.repeat(64));
    expect(body(server.calls[0])).toEqual({ token: 'a'.repeat(64) });
  });
});
