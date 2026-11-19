import type { AppError } from '@/lib/contracts';
import type { Comment, Post, PostListResult } from '@/lib/posts';

export function makePost(over: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: { id: 'u2', username: 'bob', avatar: null },
    content: 'Hello world',
    image: null,
    thumbnail: null,
    likeCount: 3,
    likedByMe: false,
    bookmarked: false,
    comments: [],
    commentCount: 0,
    hashtags: [],
    mentions: [],
    isMine: false,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    ...over,
  };
}

export function makeComment(over: Partial<Comment> & { id: string }): Comment {
  return {
    author: { id: 'u2', username: 'bob', avatar: null },
    content: `comment ${over.id}`,
    parentId: null,
    likeCount: 0,
    likedByMe: false,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

export function makeList(over: Partial<PostListResult> = {}): PostListResult {
  return {
    posts: [],
    isLoading: false,
    error: null,
    refetch: async () => {},
    isRefetching: false,
    fetchNextPage: () => {},
    hasNextPage: false,
    isFetchingNextPage: false,
    ...over,
  };
}

export function makeError(over: Partial<AppError> = {}): AppError {
  return { status: 500, message: 'Server error', isNetworkError: false, isRateLimited: false, ...over };
}
