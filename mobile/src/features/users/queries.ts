import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { useCallback } from 'react';

import * as usersApi from '@/api/users';
import type { UserPage } from '@/api/users';
import { useAuth } from '@/auth';
import { currentViewerId } from '@/features/posts/cache';
import type { AppError } from '@/lib/contracts';
import type { Profile, UserListResult, UserSummary } from '@/lib/users';

import { flattenUsers, syncAuthUser } from './cache';
import type { UserListData } from './cache';
import { userKeys } from './keys';

const EMPTY: UserSummary[] = [];

/** 'me' → the viewer's id, so the own profile has exactly one cache entry. */
function useResolvedUserId(userId: string): { id: string; isMe: boolean } {
  const viewerId = useAuth((s) => s.user?.id ?? null);
  const id = userId === 'me' ? (viewerId ?? '') : userId;
  return { id, isMe: !!viewerId && id === viewerId };
}

export interface ProfileResult {
  profile: Profile | undefined;
  isLoading: boolean;
  error: AppError | null;
  refetch(): Promise<unknown>;
  isRefetching: boolean;
}

/**
 * A user's profile. The viewer's own id (or 'me') loads GET /users/profile — which carries email /
 * emailVerified — and keeps the auth store's user in sync. A blocked or missing user errors with status 404.
 */
export function useProfile(userId: string): ProfileResult {
  const { id, isMe } = useResolvedUserId(userId);
  const q = useQuery<Profile, AppError>({
    queryKey: userKeys.profile(id),
    queryFn: async () => {
      const viewerId = currentViewerId();
      const profile = isMe ? await usersApi.getMyProfile(viewerId) : await usersApi.getProfile(id, viewerId);
      if (profile.isMe) syncAuthUser(profile);
      return profile;
    },
    enabled: !!id,
  });
  return {
    profile: q.data,
    isLoading: q.isLoading,
    error: q.error ?? null,
    refetch: q.refetch,
    isRefetching: q.isRefetching,
  };
}

type Selected = { users: UserSummary[]; total: number | null };
const selectUsers = flattenUsers as (data: UserListData) => Selected;

function useUserList(queryKey: QueryKey, fetchPage: (page: number) => Promise<UserPage>, enabled: boolean): UserListResult {
  const q = useInfiniteQuery<UserPage, AppError, Selected, QueryKey, number>({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage ?? undefined,
    select: selectUsers,
    enabled,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage, isFetching } = q;
  const loadMore = useCallback(() => {
    // isFetching also guards against loading page N+1 while a pull-to-refresh rebuilds the pages
    if (hasNextPage && !isFetchingNextPage && !isFetching) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

  return {
    users: q.data?.users ?? EMPTY,
    total: q.data?.total ?? null,
    isLoading: q.isLoading,
    error: q.error ?? null,
    refetch: q.refetch,
    isRefetching: q.isRefetching,
    fetchNextPage: loadMore,
    hasNextPage,
    isFetchingNextPage,
  };
}

/** Who follows `userId` (newest first). */
export function useFollowers(userId: string): UserListResult {
  const { id } = useResolvedUserId(userId);
  return useUserList(userKeys.followers(id), (page) => usersApi.getFollowers(id, page, currentViewerId()), !!id);
}

/** Whom `userId` follows (newest first). */
export function useFollowing(userId: string): UserListResult {
  const { id } = useResolvedUserId(userId);
  return useUserList(userKeys.following(id), (page) => usersApi.getFollowing(id, page, currentViewerId()), !!id);
}

/** Users the viewer has blocked. */
export function useBlockedUsers(): UserListResult {
  return useUserList(userKeys.blocked(), (page) => usersApi.getBlockedUsers(page, currentViewerId()), true);
}
