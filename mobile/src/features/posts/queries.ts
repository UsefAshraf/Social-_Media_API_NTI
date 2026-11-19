import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { useCallback } from 'react';

import * as postsApi from '@/api/posts';
import type { PageParam, PostPage } from '@/api/posts';
import type { AppError } from '@/lib/contracts';
import type { Post, PostListResult } from '@/lib/posts';

import { currentViewerId, findPostInLists, flattenPosts } from './cache';
import type { PostListData } from './cache';
import { postKeys } from './keys';

const EMPTY: Post[] = [];
const FIRST_PAGE: PageParam = {};

function usePostList(
  queryKey: QueryKey,
  fetchPage: (param: PageParam) => Promise<PostPage>,
  enabled = true,
): PostListResult {
  const q = useInfiniteQuery<PostPage, AppError, Post[], QueryKey, PageParam>({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: (last) => last.next ?? undefined,
    select: flattenPosts as (data: PostListData) => Post[],
    enabled,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage, isFetching } = q;
  const loadMore = useCallback(() => {
    // isFetching also guards against loading page N+1 while a pull-to-refresh rebuilds the pages
    if (hasNextPage && !isFetchingNextPage && !isFetching) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

  return {
    posts: q.data ?? EMPTY,
    isLoading: q.isLoading,
    error: q.error ?? null,
    refetch: q.refetch,
    isRefetching: q.isRefetching,
    fetchNextPage: loadMore,
    hasNextPage,
    isFetchingNextPage,
  };
}

/** Following + own posts. */
export function useFeed(): PostListResult {
  return usePostList(postKeys.feed(), (p) => postsApi.getFeed(p, currentViewerId()));
}

/** Everyone's posts. */
export function useDiscover(): PostListResult {
  return usePostList(postKeys.discover(), (p) => postsApi.getDiscover(p, currentViewerId()));
}

export function useUserPosts(userId: string): PostListResult {
  return usePostList(postKeys.user(userId), (p) => postsApi.getUserPosts(userId, p, currentViewerId()), !!userId);
}

export function useHashtagPosts(tag: string): PostListResult {
  return usePostList(
    postKeys.hashtag(tag),
    (p) => postsApi.getHashtagPosts(tag, p, currentViewerId()),
    !!postsApi.normalizeTag(tag),
  );
}

/** Single page (the endpoint isn't paged): hasNextPage is always false. */
export function useTrendingPosts(): PostListResult {
  return usePostList(postKeys.trending(), () => postsApi.getTrendingPosts(currentViewerId()));
}

export function useBookmarks(): PostListResult {
  return usePostList(postKeys.bookmarks(), (p) => postsApi.getBookmarks(p, currentViewerId()));
}

/** One post with its comments. Shows the copy from any cached list while the detail loads. */
export function usePost(id: string): {
  post: Post | undefined;
  isLoading: boolean;
  error: AppError | null;
  refetch(): Promise<unknown>;
} {
  const qc = useQueryClient();
  const q = useQuery<Post, AppError>({
    queryKey: postKeys.detail(id),
    queryFn: () => postsApi.getPost(id, currentViewerId()),
    placeholderData: () => findPostInLists(qc, id),
    enabled: !!id,
  });
  return { post: q.data, isLoading: q.isLoading, error: q.error ?? null, refetch: q.refetch };
}
