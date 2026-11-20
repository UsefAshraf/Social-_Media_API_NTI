/// <reference types="jest" />
jest.mock('expo-secure-store', () => require('@/api/__testutils__/secureStoreMock').secureStoreMock);
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { QueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { body, deferred, fail, fakeServer, ok, pathOf } from '@/api/__testutils__/fakeServer';
import { __resetTokenCacheForTests } from '@/api/tokenStorage';
import { useAuth } from '@/auth';
import { postKeys } from '@/features/posts/keys';
import {
  listPosts,
  ME,
  newQueryClient,
  post,
  RNFormData,
  seedList,
  wrapperFor,
} from '@/features/posts/__testutils__/fixtures';
import {
  useBlockUser,
  useFollowers,
  useProfile,
  useToggleFollow,
  useUpdateProfile,
} from '@/features/users';
import { userKeys } from '@/features/users/keys';
import {
  listUsers,
  myProfile,
  profile,
  rawMe,
  rawSummary,
  seedUsers,
  summary,
} from '@/features/users/__testutils__/fixtures';
import { API_URL } from '@/lib/config';
import type { PickedImage, Post } from '@/lib/posts';
import type { Profile } from '@/lib/users';

let qc: QueryClient;

beforeEach(() => {
  __resetTokenCacheForTests();
  qc = newQueryClient();
  useAuth.setState({
    status: 'signedIn',
    user: { id: ME, username: 'me', email: 'me@x.io', emailVerified: true },
  });
});

afterEach(() => {
  qc.clear();
});

const flush = () => act(async () => {});
const getProfile = (id: string) => qc.getQueryData<Profile>(userKeys.profile(id));

describe('useProfile', () => {
  it('loads the own profile from /users/profile under the real id and syncs the auth store', async () => {
    const server = fakeServer(() => ok(rawMe({ username: 'renamed', avatar: '/uploads/me.jpg', emailVerified: false })));
    api.defaults.adapter = server.adapter;
    const { result } = await renderHook(() => useProfile(ME), { wrapper: wrapperFor(qc) });
    await waitFor(() => expect(result.current.profile).toBeDefined());
    expect(pathOf(server.calls[0])).toBe('/users/profile');
    expect(result.current.profile).toMatchObject({ isMe: true, email: 'me@x.io', emailVerified: false });
    expect(useAuth.getState().user).toMatchObject({
      username: 'renamed',
      avatar: `${API_URL}/uploads/me.jpg`,
      emailVerified: false,
    });

    // 'me' shares the same cache entry
    const { result: alias } = await renderHook(() => useProfile('me'), { wrapper: wrapperFor(qc) });
    expect(alias.current.profile?.id).toBe(ME);
    expect(server.calls).toHaveLength(1);
  });

  it('loads others from /users/:id and exposes 404 as an AppError', async () => {
    api.defaults.adapter = fakeServer(() => fail(404, 'User not found')).adapter;
    const { result } = await renderHook(() => useProfile('u-x'), { wrapper: wrapperFor(qc) });
    await waitFor(() => expect(result.current.error).toMatchObject({ status: 404, message: 'User not found' }));
  });
});

describe('useToggleFollow', () => {
  function seedFollowScenario() {
    qc.setQueryData(userKeys.profile('u1'), profile({ _id: 'u1', followersCount: 5, isFollowing: false }));
    qc.setQueryData(userKeys.profile(ME), myProfile({ followingCount: 2 }));
    seedUsers(qc, userKeys.followers('u9'), [summary('u1'), summary('u2')]);
    seedUsers(qc, userKeys.following('u8'), [summary('u1')]);
  }
  const rowsFollowing = () => [
    listUsers(qc, userKeys.followers('u9'))!.find((u) => u.id === 'u1')!.isFollowing,
    listUsers(qc, userKeys.following('u8'))!.find((u) => u.id === 'u1')!.isFollowing,
  ];

  it('optimistically updates target + own counts + list rows, then reconciles with server counts and refreshes the feed', async () => {
    seedFollowScenario();
    seedList(qc, postKeys.feed(), [post()]);
    const gate = deferred();
    const server = fakeServer(async () => {
      await gate.promise;
      return ok({ following: true, followersCount: 9, followingCount: 4 });
    });
    api.defaults.adapter = server.adapter;

    const { result } = await renderHook(() => useToggleFollow(), { wrapper: wrapperFor(qc) });
    await act(async () => result.current.toggle({ id: 'u1', isFollowing: false }));

    expect(getProfile('u1')).toMatchObject({ isFollowing: true, followersCount: 6 });
    expect(getProfile(ME)).toMatchObject({ followingCount: 3 });
    expect(rowsFollowing()).toEqual([true, true]);
    expect(listUsers(qc, userKeys.followers('u9'))!.find((u) => u.id === 'u2')!.isFollowing).toBe(false);
    expect(server.calls[0].method).toBe('post');
    expect(pathOf(server.calls[0])).toBe('/users/u1/follow');

    gate.resolve();
    await waitFor(() => expect(getProfile('u1')).toMatchObject({ isFollowing: true, followersCount: 9 }));
    expect(getProfile(ME)).toMatchObject({ followingCount: 4 });
    expect(qc.getQueryState(postKeys.feed())?.isInvalidated).toBe(true);
  });

  it('rolls everything back when the request fails', async () => {
    seedFollowScenario();
    const gate = deferred();
    api.defaults.adapter = fakeServer(async () => {
      await gate.promise;
      return fail(403, 'blocked');
    }).adapter;

    const { result } = await renderHook(() => useToggleFollow(), { wrapper: wrapperFor(qc) });
    await act(async () => result.current.toggle({ id: 'u1', isFollowing: false }));
    expect(getProfile('u1')).toMatchObject({ isFollowing: true, followersCount: 6 });

    gate.resolve();
    await waitFor(() => expect(getProfile('u1')).toMatchObject({ isFollowing: false, followersCount: 5 }));
    expect(getProfile(ME)).toMatchObject({ followingCount: 2 });
    expect(rowsFollowing()).toEqual([false, false]);
  });

  it('rapid double-tap is serialised and ends in sync (based on cache, not the stale argument)', async () => {
    seedFollowScenario();
    let following = false;
    let followers = 5;
    const gates = [deferred(), deferred()];
    let call = 0;
    const server = fakeServer(async (config) => {
      const g = gates[call++];
      await g.promise;
      following = config.method === 'post';
      followers += following ? 1 : -1;
      return ok({ following, followersCount: followers, followingCount: following ? 3 : 2 });
    });
    api.defaults.adapter = server.adapter;

    const { result } = await renderHook(() => useToggleFollow(), { wrapper: wrapperFor(qc) });
    await act(async () => {
      result.current.toggle({ id: 'u1', isFollowing: false });
      result.current.toggle({ id: 'u1', isFollowing: false }); // stale argument
    });
    expect(getProfile('u1')).toMatchObject({ isFollowing: false, followersCount: 5 });
    expect(getProfile(ME)).toMatchObject({ followingCount: 2 });
    // serialised: the second request waits for the first
    expect(server.calls).toHaveLength(1);

    gates[0].resolve();
    await flush();
    // first response must not flash "following" while the unfollow is still queued
    expect(getProfile('u1')).toMatchObject({ isFollowing: false, followersCount: 5 });
    expect(server.calls.map((c) => c.method)).toEqual(['post', 'delete']);

    gates[1].resolve();
    await flush();
    expect(getProfile('u1')).toMatchObject({ isFollowing: false, followersCount: 5 });
    expect(getProfile(ME)).toMatchObject({ followingCount: 2 });
    expect(rowsFollowing()).toEqual([false, false]);
  });

  it('when the last of several taps fails, keeps the last confirmed server state', async () => {
    seedFollowScenario();
    let call = 0;
    api.defaults.adapter = fakeServer(() => {
      call += 1;
      return call === 1 ? ok({ following: true, followersCount: 6, followingCount: 3 }) : fail(500);
    }).adapter;
    const { result } = await renderHook(() => useToggleFollow(), { wrapper: wrapperFor(qc) });
    await act(async () => {
      result.current.toggle({ id: 'u1', isFollowing: false });
      result.current.toggle({ id: 'u1', isFollowing: true });
    });
    await flush();
    expect(call).toBe(2);
    expect(getProfile('u1')).toMatchObject({ isFollowing: true, followersCount: 6 });
    expect(getProfile(ME)).toMatchObject({ followingCount: 3 });
    expect(rowsFollowing()).toEqual([true, true]);
  });

  it('ignores toggling yourself', async () => {
    const server = fakeServer(() => ok({}));
    api.defaults.adapter = server.adapter;
    const { result } = await renderHook(() => useToggleFollow(), { wrapper: wrapperFor(qc) });
    await act(async () => result.current.toggle({ id: ME, isFollowing: false }));
    expect(server.calls).toHaveLength(0);
  });
});

describe('useUpdateProfile', () => {
  const realFormData = globalThis.FormData;
  beforeAll(() => {
    (globalThis as { FormData: unknown }).FormData = RNFormData;
  });
  afterAll(() => {
    globalThis.FormData = realFormData;
  });

  const image: PickedImage = { uri: 'file:///cache/me.jpg', width: 400, height: 400, mimeType: 'image/jpeg', fileSize: 999 };

  it('sends multipart `image`, reports progress and updates own profile, auth store, post authors and list rows', async () => {
    qc.setQueryData(userKeys.profile(ME), myProfile({ followersCount: 4 }));
    const mine = post({ _id: 'm1', author: { _id: ME, username: 'me', avatar: '' } });
    const theirs = post({
      _id: 't1',
      comments: [{ _id: 'c1', author: { _id: ME, username: 'me' }, content: 'hey', createdAt: '2026-01-01T00:00:00.000Z' }],
    });
    seedList(qc, postKeys.feed(), [mine, theirs]);
    seedList(qc, postKeys.user(ME), [mine]);
    qc.setQueryData(postKeys.detail('m1'), mine);
    seedUsers(qc, userKeys.followers('u1'), [summary(ME, { isMe: true })]);

    const seen: number[] = [];
    const server = fakeServer((config) => {
      config.onUploadProgress?.({ loaded: 50, total: 100, progress: 0.5, bytes: 50, lengthComputable: true });
      seen.push(0.5);
      return ok(rawMe({ username: 'newme', bio: 'new bio', avatar: '/uploads/new.jpg', followersCount: 4 }));
    });
    api.defaults.adapter = server.adapter;

    const { result } = await renderHook(() => useUpdateProfile(), { wrapper: wrapperFor(qc) });
    let updated!: Profile;
    await act(async () => {
      updated = await result.current.updateProfile({ username: 'newme', bio: 'new bio', avatar: image });
    });

    const config = server.calls[0];
    expect(config.method).toBe('patch');
    expect(pathOf(config)).toBe('/users/profile');
    const form = config.data as RNFormData;
    expect(form).toBeInstanceOf(RNFormData);
    expect(form._parts).toEqual([
      ['username', 'newme'],
      ['bio', 'new bio'],
      ['image', { uri: 'file:///cache/me.jpg', name: 'avatar.jpg', type: 'image/jpeg' }],
    ]);
    expect(String(config.headers['Content-Type'])).toContain('multipart/form-data');
    expect(seen).toEqual([0.5]);
    expect(result.current.progress).toBeNull();

    const avatar = `${API_URL}/uploads/new.jpg`;
    expect(updated).toMatchObject({ username: 'newme', avatar, bio: 'new bio' });
    expect(getProfile(ME)).toMatchObject({ username: 'newme', avatar, bio: 'new bio', followersCount: 4 });
    expect(useAuth.getState().user).toEqual({
      id: ME,
      username: 'newme',
      email: 'me@x.io',
      avatar,
      bio: 'new bio',
      emailVerified: true,
    });
    const feed = listPosts(qc, postKeys.feed())!;
    expect(feed[0].author).toMatchObject({ id: ME, username: 'newme', avatar });
    expect(feed[1].author.id).toBe('u-other');
    expect(feed[1].comments[0].author).toMatchObject({ username: 'newme', avatar });
    expect(listPosts(qc, postKeys.user(ME))![0].author.username).toBe('newme');
    expect(qc.getQueryData<Post>(postKeys.detail('m1'))!.author).toMatchObject({ username: 'newme', avatar });
    expect(listUsers(qc, userKeys.followers('u1'))![0]).toMatchObject({ username: 'newme', avatar, bio: 'new bio' });
  });

  it('avatar: null sends JSON avatar "" (remove)', async () => {
    const server = fakeServer((config) => {
      expect(body(config)).toEqual({ avatar: '' });
      return ok(rawMe({ avatar: '' }));
    });
    api.defaults.adapter = server.adapter;
    useAuth.setState({
      user: { id: ME, username: 'me', email: 'me@x.io', emailVerified: true, avatar: 'https://x/a.jpg' },
    });
    const { result } = await renderHook(() => useUpdateProfile(), { wrapper: wrapperFor(qc) });
    await act(async () => {
      await result.current.updateProfile({ avatar: null });
    });
    expect(server.calls).toHaveLength(1);
    expect(useAuth.getState().user?.avatar).toBeNull();
  });

  it('exposes the server error (duplicate username)', async () => {
    api.defaults.adapter = fakeServer(() => fail(400, 'Username already exists')).adapter;
    const { result } = await renderHook(() => useUpdateProfile(), { wrapper: wrapperFor(qc) });
    await act(async () => {
      await expect(result.current.updateProfile({ username: 'taken' })).rejects.toMatchObject({
        status: 400,
        message: 'Username already exists',
      });
    });
    await waitFor(() => expect(result.current.error).toMatchObject({ message: 'Username already exists' }));
    expect(useAuth.getState().user?.username).toBe('me');
  });
});

describe('useBlockUser', () => {
  it('removes their posts, profile and list rows, adjusts own counts and refreshes', async () => {
    const theirs = post({ _id: 'b1', author: { _id: 'u-bad', username: 'bad' } });
    const other = post({ _id: 'o1' });
    seedList(qc, postKeys.feed(), [theirs, other]);
    seedList(qc, postKeys.discover(), [other, theirs]);
    qc.setQueryData(postKeys.detail('b1'), theirs);
    qc.setQueryData(userKeys.profile('u-bad'), profile({ _id: 'u-bad', isFollowing: true, followsYou: true }));
    qc.setQueryData(userKeys.profile(ME), myProfile({ followersCount: 3, followingCount: 5 }));
    seedUsers(qc, userKeys.following(ME), [summary('u-bad'), summary('u2')]);
    seedUsers(qc, userKeys.blocked(), []);

    const server = fakeServer(() => ok({ blocked: true }));
    api.defaults.adapter = server.adapter;
    const { result } = await renderHook(() => useBlockUser(), { wrapper: wrapperFor(qc) });
    await act(() => result.current.block('u-bad'));

    expect(server.calls[0].method).toBe('post');
    expect(pathOf(server.calls[0])).toBe('/users/u-bad/block');
    expect(listPosts(qc, postKeys.feed())!.map((p) => p.id)).toEqual(['o1']);
    expect(listPosts(qc, postKeys.discover())!.map((p) => p.id)).toEqual(['o1']);
    expect(qc.getQueryCache().find({ queryKey: postKeys.detail('b1') })).toBeUndefined();
    expect(qc.getQueryCache().find({ queryKey: userKeys.profile('u-bad') })).toBeUndefined();
    expect(listUsers(qc, userKeys.following(ME))!.map((u) => u.id)).toEqual(['u2']);
    expect(getProfile(ME)).toMatchObject({ followersCount: 2, followingCount: 4 });
    expect(qc.getQueryState(userKeys.profile(ME))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(userKeys.blocked())?.isInvalidated).toBe(true);
  });

  it('unblock invalidates the blocked list and the feed', async () => {
    seedUsers(qc, userKeys.blocked(), [summary('u-bad')]);
    seedList(qc, postKeys.feed(), []);
    const server = fakeServer(() => ok({ blocked: false }));
    api.defaults.adapter = server.adapter;
    const { result } = await renderHook(() => useBlockUser(), { wrapper: wrapperFor(qc) });
    await act(() => result.current.unblock('u-bad'));
    expect(server.calls[0].method).toBe('delete');
    expect(pathOf(server.calls[0])).toBe('/users/u-bad/block');
    expect(qc.getQueryState(userKeys.blocked())?.isInvalidated).toBe(true);
    expect(qc.getQueryState(postKeys.feed())?.isInvalidated).toBe(true);
  });
});

describe('useFollowers pagination', () => {
  it('loads page by page, dedupes and stops at the last page', async () => {
    const server = fakeServer((config) => {
      const page = Number(config.params?.page);
      const data =
        page === 1 ? [rawSummary('a'), rawSummary('b')] : [rawSummary('b'), rawSummary('c', { isFollowing: true })];
      return { status: 200, data: { success: true, data, pagination: { page, limit: 2, total: 3, pages: 2 } } };
    });
    api.defaults.adapter = server.adapter;

    const { result } = await renderHook(() => useFollowers('u1'), { wrapper: wrapperFor(qc) });
    await waitFor(() => expect(result.current.users).toHaveLength(2));
    expect(pathOf(server.calls[0])).toBe('/users/u1/followers');
    expect(server.calls[0].params).toMatchObject({ page: 1 });
    expect(result.current.total).toBe(3);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.users.map((u) => u.id)).toEqual(['a', 'b', 'c']));
    expect(result.current.users[2].isFollowing).toBe(true);
    expect(result.current.hasNextPage).toBe(false);

    await act(async () => result.current.fetchNextPage());
    await flush();
    expect(server.calls).toHaveLength(2);
  });
});
