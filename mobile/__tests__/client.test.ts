/// <reference types="jest" />
jest.mock('expo-secure-store', () => require('@/api/__testutils__/secureStoreMock').secureStoreMock);

import { api, http, refreshSession, setOnSessionExpired } from '@/api/client';
import { authHeader, body, deferred, fail, fakeServer, ok, pathOf } from '@/api/__testutils__/fakeServer';
import { mockSecureStoreData } from '@/api/__testutils__/secureStoreMock';
import {
  __resetTokenCacheForTests,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '@/api/tokenStorage';

const REFRESH_KEY = 'auth.refreshToken';

beforeEach(async () => {
  mockSecureStoreData.clear();
  __resetTokenCacheForTests();
  setOnSessionExpired(null);
  await setTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' });
});

describe('request interceptor', () => {
  it('adds the Bearer access token', async () => {
    const server = fakeServer(() => ok({ hello: 1 }));
    api.defaults.adapter = server.adapter;
    await expect(http.get('/posts')).resolves.toEqual({ hello: 1 });
    expect(authHeader(server.calls[0])).toBe('Bearer old-access');
  });
});

describe('401 handling', () => {
  it('concurrent 401s trigger exactly one refresh and all requests retry with the new token', async () => {
    const gate = deferred();
    const server = fakeServer(async (config) => {
      const path = pathOf(config);
      if (path === '/auth/refresh') {
        await gate.promise; // hold the refresh open so every 401 piles up on it
        expect(body(config)).toEqual({ refreshToken: 'old-refresh' });
        return ok({ accessToken: 'new-access', refreshToken: 'new-refresh' });
      }
      return authHeader(config) === 'Bearer new-access' ? ok({ path }) : fail(401, 'jwt expired');
    });
    api.defaults.adapter = server.adapter;

    const results = Promise.all([http.get('/a'), http.get('/b'), http.get('/c'), http.post('/d', { x: 1 })]);
    // let all four initial requests fail before the refresh completes
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    gate.resolve();

    await expect(results).resolves.toEqual([{ path: '/a' }, { path: '/b' }, { path: '/c' }, { path: '/d' }]);
    expect(server.callsTo('/auth/refresh')).toHaveLength(1);
    expect(server.calls.filter((c) => pathOf(c) !== '/auth/refresh')).toHaveLength(8); // 4 originals + 4 retries
    expect(getAccessToken()).toBe('new-access');
    expect(mockSecureStoreData.get(REFRESH_KEY)).toBe('new-refresh');
  });

  it('a 401 arriving after another request already refreshed retries without refreshing again', async () => {
    const server = fakeServer((config) => {
      if (pathOf(config) === '/auth/refresh') return ok({ accessToken: 'new-access', refreshToken: 'new-refresh' });
      return authHeader(config) === 'Bearer new-access' ? ok('fine') : fail(401);
    });
    api.defaults.adapter = server.adapter;
    await http.get('/first');
    expect(server.callsTo('/auth/refresh')).toHaveLength(1);
    // simulate a stale in-flight request that was sent with the old token
    await expect(http.get('/late', { headers: { Authorization: 'Bearer old-access' } })).resolves.toBe('fine');
    expect(server.callsTo('/auth/refresh')).toHaveLength(1);
  });

  it('retries only once: a second 401 after refresh is surfaced as AppError', async () => {
    const server = fakeServer((config) =>
      pathOf(config) === '/auth/refresh' ? ok({ accessToken: 'new-access', refreshToken: 'new-refresh' }) : fail(401, 'still no'),
    );
    api.defaults.adapter = server.adapter;
    await expect(http.get('/x')).rejects.toMatchObject({ status: 401, message: 'still no' });
    expect(server.callsTo('/x')).toHaveLength(2);
    expect(server.callsTo('/auth/refresh')).toHaveLength(1);
  });

  it('failed refresh clears tokens and fires onSessionExpired once', async () => {
    const onExpired = jest.fn();
    setOnSessionExpired(onExpired);
    const server = fakeServer((config) =>
      pathOf(config) === '/auth/refresh' ? fail(401, 'Invalid refresh token') : fail(401, 'jwt expired'),
    );
    api.defaults.adapter = server.adapter;

    const results = await Promise.allSettled([http.get('/a'), http.get('/b')]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect((results[0] as PromiseRejectedResult).reason).toMatchObject({ status: 401, isNetworkError: false });
    expect(server.callsTo('/auth/refresh')).toHaveLength(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(mockSecureStoreData.has(REFRESH_KEY)).toBe(false);
    __resetTokenCacheForTests();
    expect(await getRefreshToken()).toBeNull();
  });

  it('transient refresh failure (network) keeps the stored session and does not expire it', async () => {
    const onExpired = jest.fn();
    setOnSessionExpired(onExpired);
    const server = fakeServer((config) => (pathOf(config) === '/auth/refresh' ? 'network' : fail(401)));
    api.defaults.adapter = server.adapter;

    await expect(http.get('/a')).rejects.toMatchObject({ isNetworkError: true, status: null });
    expect(onExpired).not.toHaveBeenCalled();
    expect(mockSecureStoreData.get(REFRESH_KEY)).toBe('old-refresh');
  });

  it.each(['/auth/login', '/auth/register', '/auth/refresh'])('%s 401 does not trigger a refresh', async (path) => {
    const onExpired = jest.fn();
    setOnSessionExpired(onExpired);
    const server = fakeServer(() => fail(401, 'Invalid credentials'));
    api.defaults.adapter = server.adapter;

    await expect(http.post(path, {})).rejects.toMatchObject({ status: 401, message: 'Invalid credentials' });
    expect(server.calls).toHaveLength(1);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('refreshSession() is single-flight for direct callers too', async () => {
    const gate = deferred();
    const server = fakeServer(async () => {
      await gate.promise;
      return ok({ accessToken: 'n', refreshToken: 'r' });
    });
    api.defaults.adapter = server.adapter;
    const p = Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    gate.resolve();
    await expect(p).resolves.toEqual(['n', 'n', 'n']);
    expect(server.calls).toHaveLength(1);
    // after it settles, a new refresh makes a new request
    await refreshSession();
    expect(server.calls).toHaveLength(2);
  });
});
