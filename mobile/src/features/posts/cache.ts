// Helpers that keep one post consistent across every cached list and the detail cache.
import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';

import type { PageParam, PostPage } from '@/api/posts';
import { useAuth } from '@/auth';
import type { Post } from '@/lib/posts';

import { postKeys } from './keys';

export type PostListData = InfiniteData<PostPage, PageParam>;

export const currentViewerId = (): string | null => useAuth.getState().user?.id ?? null;

function isListData(data: unknown): data is PostListData {
  return !!data && typeof data === 'object' && Array.isArray((data as PostListData).pages);
}

function mapPages(data: PostListData, fn: (posts: Post[]) => Post[]): PostListData {
  let changed = false;
  const pages = data.pages.map((page) => {
    const posts = fn(page.posts);
    if (posts === page.posts) return page;
    changed = true;
    return { ...page, posts };
  });
  return changed ? { ...data, pages } : data;
}

/**
 * Applies `updater` to the post with `postId` in every cached list and the detail cache.
 * Returning the same object leaves that cache untouched.
 */
export function updatePostEverywhere(qc: QueryClient, postId: string, updater: (post: Post) => Post): void {
  qc.setQueriesData<PostListData>({ queryKey: postKeys.lists() }, (data) => {
    if (!isListData(data)) return data;
    return mapPages(data, (posts) => {
      let changed = false;
      const next = posts.map((p) => {
        if (p.id !== postId) return p;
        const u = updater(p);
        if (u !== p) changed = true;
        return u;
      });
      return changed ? next : posts;
    });
  });
  qc.setQueryData<Post>(postKeys.detail(postId), (post) => (post ? updater(post) : post));
}

/** Removes the post from every list and drops its detail query. */
export function removePostEverywhere(qc: QueryClient, postId: string): void {
  qc.setQueriesData<PostListData>({ queryKey: postKeys.lists() }, (data) => {
    if (!isListData(data)) return data;
    return mapPages(data, (posts) => (posts.some((p) => p.id === postId) ? posts.filter((p) => p.id !== postId) : posts));
  });
  qc.removeQueries({ queryKey: postKeys.detail(postId), exact: true });
}

/** Applies `updater` to every cached post (lists and details) for which `match` is true. */
export function updatePostsWhere(qc: QueryClient, match: (post: Post) => boolean, updater: (post: Post) => Post): void {
  const apply = (p: Post) => (match(p) ? updater(p) : p);
  qc.setQueriesData<PostListData>({ queryKey: postKeys.lists() }, (data) => {
    if (!isListData(data)) return data;
    return mapPages(data, (posts) => {
      let changed = false;
      const next = posts.map((p) => {
        const u = apply(p);
        if (u !== p) changed = true;
        return u;
      });
      return changed ? next : posts;
    });
  });
  qc.setQueriesData<Post>({ queryKey: postKeys.details() }, (post) => (post && post.author ? apply(post) : post));
}

/** Sets the author's username/avatar on their posts and comments in every cached list and detail. */
export function updateAuthorEverywhere(
  qc: QueryClient,
  authorId: string,
  patch: { username?: string; avatar?: string | null },
): void {
  const fix = <T extends { author: Post['author'] }>(x: T): T => {
    if (x.author.id !== authorId) return x;
    const username = patch.username ?? x.author.username;
    const avatar = patch.avatar !== undefined ? patch.avatar : x.author.avatar;
    if (username === x.author.username && avatar === x.author.avatar) return x;
    return { ...x, author: { ...x.author, username, avatar } };
  };
  updatePostsWhere(
    qc,
    (p) => p.author.id === authorId || p.comments.some((c) => c.author.id === authorId),
    (p) => {
      const withAuthor = fix(p);
      if (!p.comments.some((c) => c.author.id === authorId)) return withAuthor;
      const comments = p.comments.map(fix);
      return comments.every((c, i) => c === p.comments[i]) ? withAuthor : { ...withAuthor, comments };
    },
  );
}

/** Removes every post by `authorId` from all cached lists and drops their detail queries (e.g. after blocking them). */
export function removePostsByAuthor(qc: QueryClient, authorId: string): void {
  qc.setQueriesData<PostListData>({ queryKey: postKeys.lists() }, (data) => {
    if (!isListData(data)) return data;
    return mapPages(data, (posts) =>
      posts.some((p) => p.author.id === authorId) ? posts.filter((p) => p.author.id !== authorId) : posts,
    );
  });
  qc.removeQueries({
    queryKey: postKeys.details(),
    predicate: (q) => (q.state.data as Post | undefined)?.author?.id === authorId,
  });
}

/** Puts `post` at the top of a list's first page (only if that list is cached). */
export function prependPost(qc: QueryClient, key: QueryKey, post: Post): void {
  qc.setQueryData<PostListData>(key, (data) => {
    if (!isListData(data) || data.pages.length === 0) return data;
    const pages = data.pages.map((page) => ({ ...page, posts: page.posts.filter((p) => p.id !== post.id) }));
    pages[0] = { ...pages[0], posts: [post, ...pages[0].posts] };
    return { ...data, pages };
  });
}

/** The freshest cached copy of a post: the detail cache first, then any list. */
export function findPost(qc: QueryClient, postId: string): Post | undefined {
  return qc.getQueryData<Post>(postKeys.detail(postId)) ?? findPostInLists(qc, postId);
}

export function findPostInLists(qc: QueryClient, postId: string): Post | undefined {
  for (const [, data] of qc.getQueriesData<PostListData>({ queryKey: postKeys.lists() })) {
    if (!isListData(data)) continue;
    for (const page of data.pages) {
      const hit = page.posts.find((p) => p.id === postId);
      if (hit) return hit;
    }
  }
  return undefined;
}

function containsPost(data: unknown, postId: string): boolean {
  if (isListData(data)) return data.pages.some((page) => page.posts.some((p) => p.id === postId));
  return !!data && typeof data === 'object' && (data as Post).id === postId;
}

/**
 * Cancels in-flight fetches of queries that hold this post, so a response started before an optimistic
 * update can't overwrite it. Cancelling reverts to the last cache write, which includes the optimistic one.
 * Queries without data are left alone (cancelling a first load would leave it empty).
 */
export function cancelPostQueries(qc: QueryClient, postId: string): Promise<void> {
  return qc.cancelQueries({
    queryKey: postKeys.all,
    predicate: (q) => q.state.fetchStatus === 'fetching' && q.state.data !== undefined && containsPost(q.state.data, postId),
  });
}

/** Flattens infinite pages and drops duplicates (cursor pages can shift when new posts arrive). */
export function flattenPosts(data: PostListData): Post[] {
  const seen = new Set<string>();
  const out: Post[] = [];
  for (const page of data.pages) {
    for (const post of page.posts) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      out.push(post);
    }
  }
  return out;
}

// ---- per-QueryClient counters of in-flight optimistic mutations ----

const pendingByClient = new WeakMap<QueryClient, Map<string, number>>();

function pendingMap(qc: QueryClient) {
  let m = pendingByClient.get(qc);
  if (!m) {
    m = new Map();
    pendingByClient.set(qc, m);
  }
  return m;
}

/** Marks one more in-flight mutation for `key`; the returned function marks it done and returns how many remain. */
export function beginPending(qc: QueryClient, key: string): () => number {
  const m = pendingMap(qc);
  m.set(key, (m.get(key) ?? 0) + 1);
  let done = false;
  return () => {
    if (!done) {
      done = true;
      const left = (m.get(key) ?? 1) - 1;
      if (left <= 0) m.delete(key);
      else m.set(key, left);
    }
    return m.get(key) ?? 0;
  };
}
