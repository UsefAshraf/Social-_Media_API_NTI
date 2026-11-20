import type { AppError } from '@/lib/contracts';
import type { Comment, Post, PostListResult } from '@/lib/posts';
import type { Profile, UserListResult, UserSummary } from '@/lib/users';

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

export function makeProfile(over: Partial<Profile> = {}): Profile {
  return {
    id: 'u2',
    username: 'bob',
    avatar: null,
    bio: 'Hi, I am Bob',
    followersCount: 12,
    followingCount: 3,
    postsCount: 7,
    isMe: false,
    isFollowing: false,
    followsYou: false,
    createdAt: '2025-03-15T12:00:00.000Z',
    ...over,
  };
}

export function makeUser(over: Partial<UserSummary> & { id: string }): UserSummary {
  return { username: `user${over.id}`, avatar: null, bio: '', isMe: false, isFollowing: false, ...over };
}

export function makeUserList(over: Partial<UserListResult> = {}): UserListResult {
  return {
    users: [],
    total: null,
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
