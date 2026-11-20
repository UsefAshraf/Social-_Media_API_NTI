import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import * as usersApi from '@/api/users';
import type { FollowResult } from '@/api/users';
import { currentViewerId, removePostsByAuthor, updateAuthorEverywhere } from '@/features/posts/cache';
import { postKeys } from '@/features/posts/keys';
import type { AppError } from '@/lib/contracts';
import type { PickedImage } from '@/lib/posts';
import type { Profile } from '@/lib/users';

import {
  cancelUserQueries,
  readFollowing,
  removeUserFromLists,
  syncAuthUser,
  updateProfileCache,
  updateUserInLists,
} from './cache';
import { userKeys } from './keys';

// ---------------------------------------------------------------------------
// Follow / unfollow
// ---------------------------------------------------------------------------

/**
 * Moves the cache from `prev` to `next` following state for `targetId`: the target's isFollowing and
 * followersCount, the viewer's followingCount and the target's row in every cached list. Server counts, when
 * given, replace the ±1 arithmetic.
 */
function applyFollowState(
  qc: QueryClient,
  targetId: string,
  viewerId: string | null,
  prev: boolean,
  next: boolean,
  server?: FollowResult,
): void {
  updateProfileCache(qc, targetId, (p) => {
    const delta = p.isFollowing === next ? 0 : next ? 1 : -1;
    const followersCount = server?.followersCount ?? Math.max(0, p.followersCount + delta);
    return p.isFollowing === next && p.followersCount === followersCount
      ? p
      : { ...p, isFollowing: next, followersCount };
  });
  if (viewerId) {
    const delta = prev === next ? 0 : next ? 1 : -1;
    updateProfileCache(qc, viewerId, (p) => {
      const followingCount = server?.followingCount ?? Math.max(0, p.followingCount + delta);
      return p.followingCount === followingCount ? p : { ...p, followingCount };
    });
  }
  updateUserInLists(qc, targetId, (u) => (u.isFollowing === next || u.isMe ? u : { ...u, isFollowing: next }));
}

interface FollowSlot {
  chain: Promise<unknown>;
  pending: number;
  /** State before the first tap of the current burst (rollback target if every request fails). */
  baseline: boolean;
  /** Latest successful server response in the current burst. */
  lastOk: FollowResult | null;
}

const followSlots = new WeakMap<QueryClient, Map<string, FollowSlot>>();

function followSlot(qc: QueryClient, userId: string): FollowSlot {
  let m = followSlots.get(qc);
  if (!m) {
    m = new Map();
    followSlots.set(qc, m);
  }
  let slot = m.get(userId);
  if (!slot) {
    slot = { chain: Promise.resolve(), pending: 0, baseline: false, lastOk: null };
    m.set(userId, slot);
  }
  return slot;
}

/**
 * Optimistic, fire-and-forget follow toggle. Each tap flips the *cached* state (not the possibly stale
 * argument) and queues POST/DELETE /users/:id/follow; requests for one user are serialised so they reach the
 * server in tap order. When the last queued request settles, the cache is set to the server's latest
 * confirmed state and counts — or rolled back to the pre-burst state if every request failed.
 */
export function useToggleFollow(): { toggle(user: { id: string; isFollowing: boolean }): void } {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation<FollowResult, AppError, { userId: string; follow: boolean }>({
    mutationFn: ({ userId, follow }) => (follow ? usersApi.followUser(userId) : usersApi.unfollowUser(userId)),
  });

  const toggle = useCallback(
    (user: { id: string; isFollowing: boolean }) => {
      const id = user.id;
      const viewerId = currentViewerId();
      if (!id || id === viewerId) return;

      const slot = followSlot(qc, id);
      const current = readFollowing(qc, id) ?? user.isFollowing;
      if (slot.pending === 0) {
        slot.baseline = current;
        slot.lastOk = null;
      }
      const next = !current;
      void cancelUserQueries(qc, [id, viewerId ?? ''], id);
      applyFollowState(qc, id, viewerId, current, next);

      slot.pending += 1;
      const run = slot.chain.then(() => mutateAsync({ userId: id, follow: next }));
      slot.chain = run.catch(() => undefined);
      run
        .then(
          (res) => {
            slot.lastOk = res;
          },
          () => undefined,
        )
        .finally(() => {
          slot.pending -= 1;
          if (slot.pending > 0) return;
          const now = readFollowing(qc, id) ?? next;
          if (slot.lastOk) {
            applyFollowState(qc, id, viewerId, now, slot.lastOk.following, slot.lastOk);
            // followed users' posts appear in / disappear from the feed; list membership changed
            void qc.invalidateQueries({ queryKey: postKeys.feed() });
            void qc.invalidateQueries({ queryKey: userKeys.followers(id), refetchType: 'none' });
            if (viewerId) void qc.invalidateQueries({ queryKey: userKeys.following(viewerId), refetchType: 'none' });
          } else {
            applyFollowState(qc, id, viewerId, now, slot.baseline);
          }
          slot.lastOk = null;
        });
    },
    [qc, mutateAsync],
  );

  return { toggle };
}

// ---------------------------------------------------------------------------
// Update own profile
// ---------------------------------------------------------------------------

export interface UpdateProfileInput {
  username?: string;
  bio?: string;
  /** PickedImage = new avatar, null = remove, undefined = keep. */
  avatar?: PickedImage | null;
}

export interface UpdateProfileResult {
  updateProfile(input: UpdateProfileInput): Promise<Profile>;
  isPending: boolean;
  /** 0..1 while an avatar uploads, otherwise null. */
  progress: number | null;
  error: AppError | null;
  reset(): void;
}

/** PATCH /users/profile; on success updates the own-profile cache, the auth store and the viewer's posts' author. */
export function useUpdateProfile(): UpdateProfileResult {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const m = useMutation<Profile, AppError, UpdateProfileInput>({
    mutationFn: (input) =>
      usersApi.updateProfile(input, currentViewerId(), input.avatar ? { onProgress: setProgress } : undefined),
    onSuccess: (profile) => {
      void qc.cancelQueries({ queryKey: userKeys.profile(profile.id), exact: true });
      qc.setQueryData<Profile>(userKeys.profile(profile.id), profile);
      syncAuthUser(profile);
      updateAuthorEverywhere(qc, profile.id, { username: profile.username, avatar: profile.avatar });
      updateUserInLists(qc, profile.id, (u) =>
        u.username === profile.username && u.avatar === profile.avatar && u.bio === profile.bio
          ? u
          : { ...u, username: profile.username, avatar: profile.avatar, bio: profile.bio },
      );
    },
  });
  const { mutateAsync, reset: resetMutation } = m;

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      setProgress(input.avatar ? 0 : null);
      try {
        return await mutateAsync(input);
      } finally {
        setProgress(null);
      }
    },
    [mutateAsync],
  );
  const reset = useCallback(() => {
    resetMutation();
    setProgress(null);
  }, [resetMutation]);

  return { updateProfile, isPending: m.isPending, progress, error: m.error ?? null, reset };
}

// ---------------------------------------------------------------------------
// Block / unblock
// ---------------------------------------------------------------------------

function afterBlock(qc: QueryClient, userId: string): void {
  const viewerId = currentViewerId();
  // Blocking removes follows both ways: adjust the viewer's counts now, then refetch for the truth.
  const target = qc.getQueryData<Profile>(userKeys.profile(userId));
  if (viewerId && target) {
    updateProfileCache(qc, viewerId, (p) => {
      const followingCount = Math.max(0, p.followingCount - (target.isFollowing ? 1 : 0));
      const followersCount = Math.max(0, p.followersCount - (target.followsYou ? 1 : 0));
      return followingCount === p.followingCount && followersCount === p.followersCount
        ? p
        : { ...p, followingCount, followersCount };
    });
  }
  removePostsByAuthor(qc, userId);
  qc.removeQueries({ queryKey: userKeys.profile(userId), exact: true });
  qc.removeQueries({ queryKey: userKeys.followers(userId), exact: true });
  qc.removeQueries({ queryKey: userKeys.following(userId), exact: true });
  removeUserFromLists(qc, userId);
  if (viewerId) void qc.invalidateQueries({ queryKey: userKeys.profile(viewerId), exact: true });
  void qc.invalidateQueries({ queryKey: userKeys.blocked() });
}

/** Block / unblock; both reject with AppError. After blocking, navigate away from that user's screens (their profile is a 404 now). */
export function useBlockUser(): {
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;
  isPending: boolean;
} {
  const qc = useQueryClient();
  const blockM = useMutation<void, AppError, string>({
    mutationFn: (userId) => usersApi.blockUser(userId),
    onSuccess: (_void, userId) => afterBlock(qc, userId),
  });
  const unblockM = useMutation<void, AppError, string>({
    mutationFn: (userId) => usersApi.unblockUser(userId),
    onSuccess: (_void, userId) => {
      void qc.invalidateQueries({ queryKey: userKeys.blocked() });
      void qc.invalidateQueries({ queryKey: postKeys.feed() });
      void qc.invalidateQueries({ queryKey: userKeys.profile(userId), exact: true });
    },
  });
  const { mutateAsync: blockAsync } = blockM;
  const { mutateAsync: unblockAsync } = unblockM;
  const block = useCallback(async (userId: string) => blockAsync(userId), [blockAsync]);
  const unblock = useCallback(async (userId: string) => unblockAsync(userId), [unblockAsync]);
  return { block, unblock, isPending: blockM.isPending || unblockM.isPending };
}
