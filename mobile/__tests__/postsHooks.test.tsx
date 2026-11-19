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
import {
  useCreatePost,
  useDeletePost,
  useFeed,
  useToggleCommentLike,
  useToggleLike,
  useUpdatePost,
  useUserPosts,
} from '@/features/posts';
import { postKeys } from '@/features/posts/keys';
import {
  listPosts,
  ME,
  newQueryClient,
  post,
  rawPost,
  RNFormData,
  seedList,
  wrapperFor,
} from '@/features/posts/__testutils__/fixtures';
import type { PickedImage, Post } from '@/lib/posts';

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

describe('useToggleLike', () => {
  it('optimistically updates the post in every list and the detail cache, then reconciles', async () => {
    const p = post({ _id: 'p1', likes: ['u-a'] });
    seedList(qc, postKeys.feed(), [p]);
    seedList(qc, postKeys.discover(), [post(), p]);
    qc.setQueryData(postKeys.detail('p1'), p);

    const gate = deferred();
    const server = fakeServer(async (config) => {
      await gate.promise;
      expect(pathOf(config)).toBe('/posts/p1/like');
      expect(config.method).toBe('post');
      // server says 3 likes (someone else liked meanwhile)
      return ok(rawPost({ _id: 'p1', likes: ['u-a', 'u-b', ME] }));
    });
    api.defaults.adapter = server.adapter;

    const { result } = await renderHook(() => useToggleLike(), { wrapper: wrapperFor(qc) });
    await act(async () => result.current.toggle(p));

    const check = (likeCount: number) => {
      for (const found of [
        listPosts(qc, postKeys.feed())!.find((x) => x.id === 'p1')!,
        listPosts(qc, postKeys.discover())!.find((x) => x.id === 'p1')!,
        qc.getQueryData<Post>(postKeys.detail('p1'))!,
      ]) {
        expect(found).toMatchObject({ likedByMe: true, likeCount });
      }
    };
    check(2);

    gate.resolve();
    await waitFor(() => check(3));
  });

  it('rolls back every cache when the request fails', async () => {
    const p = post({ _id: 'p1' });
    seedList(qc, postKeys.feed(), [p]);
    qc.setQueryData(postKeys.detail('p1'), p);
    const gate = deferred();
    api.defaults.adapter = fakeServer(async () => {
      await gate.promise;
      return fail(500);
    }).adapter;

    const { result } = await renderHook(() => useToggleLike(), { wrapper: wrapperFor(qc) });
    await act(async () => result.current.toggle(p));
    expect(listPosts(qc, postKeys.feed())![0]).toMatchObject({ likedByMe: true, likeCount: 1 });

    gate.resolve();
    await waitFor(() => expect(listPosts(qc, postKeys.feed())![0]).toMatchObject({ likedByMe: false, likeCount: 0 }));
    expect(qc.getQueryData<Post>(postKeys.detail('p1'))).toMatchObject({ likedByMe: false, likeCount: 0 });
  });

  it('rapid double-tap ends in sync with the server (toggles based on cache state, not the stale prop)', async () => {
    const p = post({ _id: 'p1' });
    seedList(qc, postKeys.feed(), [p]);
    let liked = false;
    const gates = [deferred(), deferred()];
    let call = 0;
    api.defaults.adapter = fakeServer(async () => {
      const g = gates[call++];
      await g.promise;
      liked = !liked;
      return ok(rawPost({ _id: 'p1', likes: liked ? [ME] : [] }));
    }).adapter;

    const { result } = await renderHook(() => useToggleLike(), { wrapper: wrapperFor(qc) });
    await act(async () => {
      result.current.toggle(p); // stale prop both times
      result.current.toggle(p);
    });
    expect(listPosts(qc, postKeys.feed())![0]).toMatchObject({ likedByMe: false, likeCount: 0 });

    // first response (liked) must not flash the UI while the second toggle is still in flight
    gates[0].resolve();
    await flush();
    expect(listPosts(qc, postKeys.feed())![0]).toMatchObject({ likedByMe: false, likeCount: 0 });

    gates[1].resolve();
    await flush();
    expect(call).toBe(2);
    expect(listPosts(qc, postKeys.feed())![0]).toMatchObject({ likedByMe: false, likeCount: 0 });
  });

  it('cancels an in-flight refetch so it cannot overwrite the optimistic state', async () => {
    const gate = deferred();
    let feedCalls = 0;
    api.defaults.adapter = fakeServer(async (config) => {
      if (pathOf(config) === '/posts/feed') {
        feedCalls += 1;
        if (feedCalls === 2) await gate.promise; // the refetch hangs, then returns stale "not liked"
        return { status: 200, data: { success: true, data: [rawPost({ _id: 'p1' })], pagination: { nextCursor: null } } };
      }
      return ok(rawPost({ _id: 'p1', likes: [ME] }));
    }).adapter;

    const { result } = await renderHook(() => ({ feed: useFeed(), like: useToggleLike() }), {
      wrapper: wrapperFor(qc),
    });
    await waitFor(() => expect(result.current.feed.posts).toHaveLength(1));

    await act(async () => {
      void result.current.feed.refetch();
    });
    await act(async () => result.current.like.toggle(result.current.feed.posts[0]));
    gate.resolve();
    await waitFor(() => expect(result.current.feed.posts[0]).toMatchObject({ likedByMe: true, likeCount: 1 }));
    await flush();
    expect(result.current.feed.posts[0]).toMatchObject({ likedByMe: true, likeCount: 1 });
  });
});

describe('useDeletePost', () => {
  it('removes the post from every list and drops the detail query', async () => {
    const p = post({ _id: 'p1' });
    const other = post();
    seedList(qc, postKeys.feed(), [p, other]);
    seedList(qc, postKeys.discover(), [other, p]);
    seedList(qc, postKeys.user('u-other'), [p]);
    qc.setQueryData(postKeys.detail('p1'), p);
    const server = fakeServer(() => ({ status: 200, data: { success: true, message: 'deleted' } }));
    api.defaults.adapter = server.adapter;

    const { result } = await renderHook(() => useDeletePost(), { wrapper: wrapperFor(qc) });
    await act(() => result.current.deletePost('p1'));

    expect(server.calls[0].method).toBe('delete');
    expect(pathOf(server.calls[0])).toBe('/posts/p1');
    expect(listPosts(qc, postKeys.feed())!.map((x) => x.id)).toEqual([other.id]);
    expect(listPosts(qc, postKeys.discover())!.map((x) => x.id)).toEqual([other.id]);
    expect(listPosts(qc, postKeys.user('u-other'))).toEqual([]);
    expect(qc.getQueryCache().find({ queryKey: postKeys.detail('p1') })).toBeUndefined();
  });

  it('keeps the caches and rejects with AppError on failure', async () => {
    const p = post({ _id: 'p1' });
    seedList(qc, postKeys.feed(), [p]);
    api.defaults.adapter = fakeServer(() => fail(403, 'Not authorized to delete this post')).adapter;
    const { result } = await renderHook(() => useDeletePost(), { wrapper: wrapperFor(qc) });
    await act(async () => {
      await expect(result.current.deletePost('p1')).rejects.toMatchObject({
        status: 403,
        message: 'Not authorized to delete this post',
      });
    });
    expect(listPosts(qc, postKeys.feed())).toHaveLength(1);
  });
});

describe('useCreatePost', () => {
  it('prepends the new post to feed, discover and my own list', async () => {
    const existing = post();
    seedList(qc, postKeys.feed(), [existing]);
    seedList(qc, postKeys.discover(), [existing]);
    seedList(qc, postKeys.user(ME), []);
    const server = fakeServer((config) => {
      expect(body(config)).toEqual({ content: 'hello #js' });
      return {
        status: 201,
        data: { success: true, data: rawPost({ _id: 'new', content: 'hello #js', author: { _id: ME, username: 'me' } }) },
      };
    });
    api.defaults.adapter = server.adapter;

    const { result } = await renderHook(() => useCreatePost(), { wrapper: wrapperFor(qc) });
    let created: Post | undefined;
    await act(async () => {
      created = await result.current.createPost({ content: 'hello #js' });
    });
    expect(created).toMatchObject({ id: 'new', isMine: true });
    expect(listPosts(qc, postKeys.feed())!.map((x) => x.id)).toEqual(['new', existing.id]);
    expect(listPosts(qc, postKeys.discover())!.map((x) => x.id)).toEqual(['new', existing.id]);
    expect(listPosts(qc, postKeys.user(ME))!.map((x) => x.id)).toEqual(['new']);
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('exposes the 403 message for unverified users', async () => {
    api.defaults.adapter = fakeServer(() => fail(403, 'Please verify your email first')).adapter;
    const { result } = await renderHook(() => useCreatePost(), { wrapper: wrapperFor(qc) });
    await act(async () => {
      await expect(result.current.createPost({ content: 'x' })).rejects.toMatchObject({ status: 403 });
    });
    expect(result.current.error).toMatchObject({ status: 403, message: 'Please verify your email first' });
    await act(async () => result.current.reset());
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});

describe('uploads', () => {
  const realFormData = globalThis.FormData;
  beforeAll(() => {
    (globalThis as { FormData: unknown }).FormData = RNFormData;
  });
  afterAll(() => {
    globalThis.FormData = realFormData;
  });

  const image: PickedImage = { uri: 'file:///cache/pic.jpg', width: 800, height: 600, mimeType: 'image/jpeg', fileSize: 1234 };

  it('create sends multipart with file field `image` + `content` and reports progress 0..1', async () => {
    const seen: number[] = [];
    const gate = deferred();
    const server = fakeServer(async (config) => {
      config.onUploadProgress?.({ loaded: 50, total: 100, progress: 0.5, bytes: 50, lengthComputable: true });
      await gate.promise;
      config.onUploadProgress?.({ loaded: 100, total: 100, progress: 1, bytes: 50, lengthComputable: true });
      return { status: 201, data: { success: true, data: rawPost({ _id: 'img', image: '/uploads/pic.jpg' }) } };
    });
    api.defaults.adapter = server.adapter;

    const { result } = await renderHook(() => useCreatePost(), { wrapper: wrapperFor(qc) });
    let promise!: Promise<Post>;
    await act(async () => {
      promise = result.current.createPost({ content: 'look', image });
    });
    await waitFor(() => expect(result.current.progress).toBe(0.5));
    seen.push(result.current.progress!);
    gate.resolve();
    let created!: Post;
    await act(async () => {
      created = await promise;
    });

    const config = server.calls[0];
    expect(config.method).toBe('post');
    expect(pathOf(config)).toBe('/posts');
    const form = config.data as RNFormData;
    expect(form).toBeInstanceOf(RNFormData); // not JSON-stringified
    expect(form._parts).toEqual([
      ['content', 'look'],
      ['image', { uri: 'file:///cache/pic.jpg', name: 'post.jpg', type: 'image/jpeg' }],
    ]);
    expect(String(config.headers['Content-Type'])).toContain('multipart/form-data');
    expect(seen).toEqual([0.5]);
    expect(created.image).toMatch(/\/uploads\/pic\.jpg$/);
    expect(result.current.progress).toBeNull();
  });

  it('update with image: null sends JSON image "" (remove) and replaces the post everywhere', async () => {
    const p = post({ _id: 'p1', image: '/uploads/old.jpg' });
    seedList(qc, postKeys.feed(), [p]);
    qc.setQueryData(postKeys.detail('p1'), p);
    const server = fakeServer((config) => {
      expect(config.method).toBe('patch');
      expect(body(config)).toEqual({ content: 'edited', image: '' });
      return ok(rawPost({ _id: 'p1', content: 'edited', image: '' }));
    });
    api.defaults.adapter = server.adapter;

    const { result } = await renderHook(() => useUpdatePost(), { wrapper: wrapperFor(qc) });
    await act(async () => {
      await result.current.updatePost({ postId: 'p1', content: 'edited', image: null });
    });
    expect(listPosts(qc, postKeys.feed())![0]).toMatchObject({ content: 'edited', image: null });
    expect(qc.getQueryData<Post>(postKeys.detail('p1'))).toMatchObject({ content: 'edited', image: null });
  });

  it('update with a new image sends multipart PATCH', async () => {
    const server = fakeServer(() => ok(rawPost({ _id: 'p1', image: '/uploads/new.jpg' })));
    api.defaults.adapter = server.adapter;
    const { result } = await renderHook(() => useUpdatePost(), { wrapper: wrapperFor(qc) });
    await act(async () => {
      await result.current.updatePost({ postId: 'p1', image });
    });
    const form = server.calls[0].data as RNFormData;
    expect(form._parts.map(([k]) => k)).toEqual(['image']);
  });
});

describe('useToggleCommentLike', () => {
  it('optimistically toggles in every cache, reconciles with the server count, rolls back on failure', async () => {
    const p = post({
      _id: 'p1',
      comments: [
        { _id: 'c1', author: { _id: 'u-a', username: 'a' }, content: 'x', parentId: null, likes: [], createdAt: '2026-01-01' },
      ],
    });
    seedList(qc, postKeys.feed(), [p]);
    qc.setQueryData(postKeys.detail('p1'), p);
    let gate = deferred();
    let failNext = false;
    api.defaults.adapter = fakeServer(async (config) => {
      expect(pathOf(config)).toBe('/posts/p1/comments/c1/like');
      const shouldFail = failNext;
      await gate.promise;
      return shouldFail ? fail(500) : ok({ liked: true, likes: 4 });
    }).adapter;

    const comment = () => qc.getQueryData<Post>(postKeys.detail('p1'))!.comments[0];
    const listComment = () => listPosts(qc, postKeys.feed())![0].comments[0];

    const { result } = await renderHook(() => useToggleCommentLike('p1'), { wrapper: wrapperFor(qc) });
    await act(async () => result.current.toggle('c1'));
    expect(comment()).toMatchObject({ likedByMe: true, likeCount: 1 });
    expect(listComment()).toMatchObject({ likedByMe: true, likeCount: 1 });

    gate.resolve();
    await waitFor(() => expect(comment()).toMatchObject({ likedByMe: true, likeCount: 4 }));
    expect(listComment()).toMatchObject({ likedByMe: true, likeCount: 4 });

    failNext = true;
    gate = deferred();
    await act(async () => result.current.toggle('c1'));
    expect(comment()).toMatchObject({ likedByMe: false, likeCount: 3 });
    gate.resolve();
    await waitFor(() => expect(comment()).toMatchObject({ likedByMe: true, likeCount: 4 }));
  });
});

describe('infinite lists', () => {
  const page = (posts: unknown[], pagination: unknown) => ({ status: 200, data: { success: true, data: posts, pagination } });

  it('follows nextCursor, dedupes across pages and stops at nextCursor null', async () => {
    const a = rawPost({ _id: 'a' });
    const b = rawPost({ _id: 'b' });
    const c = rawPost({ _id: 'c' });
    const server = fakeServer((config) => {
      const cursor = config.params?.cursor;
      if (!cursor) return page([a, b], { limit: 20, nextCursor: 'cur1' });
      if (cursor === 'cur1') return page([b, c], { limit: 20, nextCursor: null }); // b shifted onto page 2
      throw new Error('fetched past the end');
    });
    api.defaults.adapter = server.adapter;

    const { result } = await renderHook(() => useFeed(), { wrapper: wrapperFor(qc) });
    await waitFor(() => expect(result.current.posts.map((p) => p.id)).toEqual(['a', 'b']));
    expect(result.current.hasNextPage).toBe(true);
    expect(server.calls[0].params).toEqual({ limit: 20 });

    await act(async () => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.posts.map((p) => p.id)).toEqual(['a', 'b', 'c']));
    expect(server.calls[1].params).toEqual({ cursor: 'cur1', limit: 20 });
    expect(result.current.hasNextPage).toBe(false);

    await act(async () => result.current.fetchNextPage());
    await flush();
    expect(server.calls).toHaveLength(2);
  });

  it('falls back to page numbers when the endpoint has no nextCursor', async () => {
    const server = fakeServer((config) => {
      expect(pathOf(config)).toBe('/posts/user/u-x');
      const pg = config.params?.page ?? 1;
      return page([rawPost({ _id: `x${pg}` })], { page: pg, pages: 2, total: 2, limit: 20 });
    });
    api.defaults.adapter = server.adapter;

    const { result } = await renderHook(() => useUserPosts('u-x'), { wrapper: wrapperFor(qc) });
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.posts.map((p) => p.id)).toEqual(['x1', 'x2']));
    expect(server.calls[1].params).toEqual({ page: 2, limit: 20 });
    expect(result.current.hasNextPage).toBe(false);
  });

  it('surfaces AppError on failure', async () => {
    api.defaults.adapter = fakeServer(() => fail(500, 'boom')).adapter;
    const { result } = await renderHook(() => useFeed(), { wrapper: wrapperFor(qc) });
    await waitFor(() => expect(result.current.error).toMatchObject({ status: 500, message: 'boom' }));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.posts).toEqual([]);
  });
});
