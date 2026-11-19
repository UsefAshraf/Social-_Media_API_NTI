import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import * as postsApi from '@/api/posts';
import { toAppError } from '@/api/errors';
import type { AppError } from '@/lib/contracts';
import type { Comment, PickedImage, Post } from '@/lib/posts';

import {
  beginPending,
  cancelPostQueries,
  currentViewerId,
  findPost,
  prependPost,
  removePostEverywhere,
  updatePostEverywhere,
} from './cache';
import { postKeys } from './keys';

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------

const invertLike = (p: Post): Post => ({
  ...p,
  likedByMe: !p.likedByMe,
  likeCount: Math.max(0, p.likeCount + (p.likedByMe ? -1 : 1)),
});

/**
 * Optimistic like toggle. The server only toggles, so each tap inverts the current cached state and a failed
 * request inverts it back (taps commute, so rapid double-taps stay in sync). Once the last in-flight toggle
 * for a post settles successfully, the like fields are reconciled with the server's post.
 */
export function useToggleLike(): { toggle(post: Post): void } {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: (postId: string) => postsApi.toggleLike(postId, currentViewerId()),
  });

  const toggle = useCallback(
    (post: Post) => {
      const id = post.id;
      // inverts whatever is cached now (not the possibly stale `post` prop)
      updatePostEverywhere(qc, id, invertLike);
      void cancelPostQueries(qc, id);
      const done = beginPending(qc, `like:${id}`);
      mutateAsync(id).then(
        (server) => {
          if (done() === 0) {
            updatePostEverywhere(qc, id, (p) =>
              p.likedByMe === server.likedByMe && p.likeCount === server.likeCount
                ? p
                : { ...p, likedByMe: server.likedByMe, likeCount: server.likeCount },
            );
          }
        },
        () => {
          done();
          updatePostEverywhere(qc, id, invertLike);
        },
      );
    },
    [qc, mutateAsync],
  );

  return { toggle };
}

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------

// Bookmark requests set a state (POST = save, DELETE = unsave), so they are chained per post to reach the
// server in tap order; only the latest tap may roll back.
const bookmarkChains = new WeakMap<QueryClient, Map<string, { chain: Promise<unknown>; seq: number }>>();

function bookmarkSlot(qc: QueryClient, postId: string) {
  let m = bookmarkChains.get(qc);
  if (!m) {
    m = new Map();
    bookmarkChains.set(qc, m);
  }
  let slot = m.get(postId);
  if (!slot) {
    slot = { chain: Promise.resolve(), seq: 0 };
    m.set(postId, slot);
  }
  return slot;
}

export function useToggleBookmark(): { toggle(post: Post): void } {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: ({ postId, save }: { postId: string; save: boolean }) =>
      save ? postsApi.bookmarkPost(postId) : postsApi.unbookmarkPost(postId),
  });

  const toggle = useCallback(
    (post: Post) => {
      const id = post.id;
      const save = !(findPost(qc, id) ?? post).bookmarked;
      updatePostEverywhere(qc, id, (p) => (p.bookmarked === save ? p : { ...p, bookmarked: save }));
      void cancelPostQueries(qc, id);

      const slot = bookmarkSlot(qc, id);
      const seq = ++slot.seq;
      const run = slot.chain.then(() => mutateAsync({ postId: id, save }));
      slot.chain = run.catch(() => undefined);
      run.then(
        () => {
          if (seq === slot.seq) void qc.invalidateQueries({ queryKey: postKeys.bookmarks() });
        },
        () => {
          if (seq === slot.seq) {
            updatePostEverywhere(qc, id, (p) => (p.bookmarked === !save ? p : { ...p, bookmarked: !save }));
          }
        },
      );
    },
    [qc, mutateAsync],
  );

  return { toggle };
}

// ---------------------------------------------------------------------------
// Delete post
// ---------------------------------------------------------------------------

export function useDeletePost(): { deletePost(postId: string): Promise<void>; isPending: boolean } {
  const qc = useQueryClient();
  const m = useMutation<void, AppError, string>({
    mutationFn: (postId) => postsApi.deletePost(postId),
    onSuccess: (_void, postId) => removePostEverywhere(qc, postId),
  });
  const { mutateAsync } = m;
  const deletePost = useCallback(async (postId: string) => mutateAsync(postId), [mutateAsync]);
  return { deletePost, isPending: m.isPending };
}

// ---------------------------------------------------------------------------
// Create / update (with upload progress)
// ---------------------------------------------------------------------------

function useProgress() {
  const [progress, setProgress] = useState<number | null>(null);
  return [progress, setProgress] as const;
}

function invalidateHashtags(qc: QueryClient, post: Post) {
  for (const tag of post.hashtags) void qc.invalidateQueries({ queryKey: postKeys.hashtag(tag) });
}

export interface CreatePostResult {
  createPost(input: { content: string; image?: PickedImage }): Promise<Post>;
  isPending: boolean;
  /** 0..1 while an image uploads, otherwise null. */
  progress: number | null;
  error: AppError | null;
  reset(): void;
}

export function useCreatePost(): CreatePostResult {
  const qc = useQueryClient();
  const [progress, setProgress] = useProgress();
  const m = useMutation<Post, AppError, { content: string; image?: PickedImage }>({
    mutationFn: (input) =>
      postsApi.createPost(input, currentViewerId(), input.image ? { onProgress: setProgress } : undefined),
    onSuccess: (post) => {
      prependPost(qc, postKeys.feed(), post);
      prependPost(qc, postKeys.discover(), post);
      prependPost(qc, postKeys.user(post.author.id), post);
      qc.setQueryData(postKeys.detail(post.id), post);
      invalidateHashtags(qc, post);
    },
  });
  const { mutateAsync, reset: resetMutation } = m;

  const createPost = useCallback(
    async (input: { content: string; image?: PickedImage }) => {
      setProgress(input.image ? 0 : null);
      try {
        return await mutateAsync(input);
      } finally {
        setProgress(null);
      }
    },
    [mutateAsync, setProgress],
  );
  const reset = useCallback(() => {
    resetMutation();
    setProgress(null);
  }, [resetMutation, setProgress]);

  return { createPost, isPending: m.isPending, progress, error: m.error ?? null, reset };
}

export interface UpdatePostInput {
  postId: string;
  content?: string;
  /** PickedImage = replace, null = remove, undefined = keep. */
  image?: PickedImage | null;
}

export interface UpdatePostResult {
  updatePost(input: UpdatePostInput): Promise<Post>;
  isPending: boolean;
  progress: number | null;
  error: AppError | null;
  reset(): void;
}

export function useUpdatePost(): UpdatePostResult {
  const qc = useQueryClient();
  const [progress, setProgress] = useProgress();
  const m = useMutation<Post, AppError, UpdatePostInput>({
    mutationFn: ({ postId, ...input }) =>
      postsApi.updatePost(postId, input, currentViewerId(), input.image ? { onProgress: setProgress } : undefined),
    onSuccess: (post) => {
      updatePostEverywhere(qc, post.id, () => post);
      invalidateHashtags(qc, post);
    },
  });
  const { mutateAsync, reset: resetMutation } = m;

  const updatePost = useCallback(
    async (input: UpdatePostInput) => {
      setProgress(input.image ? 0 : null);
      try {
        return await mutateAsync(input);
      } finally {
        setProgress(null);
      }
    },
    [mutateAsync, setProgress],
  );
  const reset = useCallback(() => {
    resetMutation();
    setProgress(null);
  }, [resetMutation, setProgress]);

  return { updatePost, isPending: m.isPending, progress, error: m.error ?? null, reset };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/** Adds a comment (or a reply with parentId) and replaces the post everywhere with the server's copy. Rejects with AppError. */
export function useAddComment(postId: string): {
  addComment(input: { content: string; parentId?: string }): Promise<void>;
  isPending: boolean;
} {
  const qc = useQueryClient();
  const m = useMutation<Post, AppError, { content: string; parentId?: string }>({
    mutationFn: (input) => postsApi.addComment(postId, input, currentViewerId()),
    onSuccess: (post) => {
      void cancelPostQueries(qc, postId);
      updatePostEverywhere(qc, postId, () => post);
    },
  });
  const { mutateAsync } = m;
  const addComment = useCallback(
    async (input: { content: string; parentId?: string }) => {
      await mutateAsync(input);
    },
    [mutateAsync],
  );
  return { addComment, isPending: m.isPending };
}

/** Replaces the comments and shifts commentCount by the change (trending posts carry a count but no comments). */
const withComments = (p: Post, comments: Comment[]): Post => ({
  ...p,
  comments,
  commentCount: Math.max(0, p.commentCount + comments.length - p.comments.length),
});

/** Optimistically removes the comment and its replies; restores them and rejects with AppError on failure. */
export function useDeleteComment(postId: string): { deleteComment(commentId: string): Promise<void> } {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation<void, AppError, string>({
    mutationFn: (commentId) => postsApi.deleteComment(postId, commentId),
  });

  const deleteComment = useCallback(
    async (commentId: string) => {
      const isGone = (c: Comment) => c.id === commentId || c.parentId === commentId;
      let removed: Comment[] = [];
      updatePostEverywhere(qc, postId, (p) => {
        const gone = p.comments.filter(isGone);
        if (gone.length === 0) return p;
        if (removed.length === 0) removed = gone;
        return withComments(
          p,
          p.comments.filter((c) => !isGone(c)),
        );
      });
      void cancelPostQueries(qc, postId);
      try {
        await mutateAsync(commentId);
      } catch (e) {
        if (removed.length) {
          updatePostEverywhere(qc, postId, (p) => {
            const have = new Set(p.comments.map((c) => c.id));
            const restored = [...p.comments, ...removed.filter((c) => !have.has(c.id))].sort((a, b) =>
              a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
            );
            return withComments(p, restored);
          });
        }
        throw toAppError(e);
      }
    },
    [qc, postId, mutateAsync],
  );

  return { deleteComment };
}

/** Optimistic comment-like toggle; same rules as useToggleLike. */
export function useToggleCommentLike(postId: string): { toggle(commentId: string): void } {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: (commentId: string) => postsApi.toggleCommentLike(postId, commentId),
  });

  const toggle = useCallback(
    (commentId: string) => {
      const setComment = (fn: (c: Comment) => Comment) =>
        updatePostEverywhere(qc, postId, (p) => {
          if (!p.comments.some((c) => c.id === commentId)) return p;
          return withComments(
            p,
            p.comments.map((c) => (c.id === commentId ? fn(c) : c)),
          );
        });
      const invert = (c: Comment): Comment => ({
        ...c,
        likedByMe: !c.likedByMe,
        likeCount: Math.max(0, c.likeCount + (c.likedByMe ? -1 : 1)),
      });

      setComment(invert);
      void cancelPostQueries(qc, postId);
      const done = beginPending(qc, `clike:${postId}:${commentId}`);
      mutateAsync(commentId).then(
        (server) => {
          if (done() === 0) {
            setComment((c) =>
              c.likedByMe === server.liked && c.likeCount === server.likeCount
                ? c
                : { ...c, likedByMe: server.liked, likeCount: server.likeCount },
            );
          }
        },
        () => {
          done();
          setComment(invert);
        },
      );
    },
    [qc, postId, mutateAsync],
  );

  return { toggle };
}
