// User/profile shapes as the UI sees them. The data layer (src/api/users.ts) maps the raw
// backend documents (_id, relative /uploads avatar paths) into these.

import type { AppError } from './contracts';

export interface Profile {
  id: string;
  username: string;
  avatar: string | null; // absolute URL or null
  bio: string; // '' when unset
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isMe: boolean;
  isFollowing: boolean; // the viewer follows this user (always false when isMe)
  followsYou: boolean; // this user follows the viewer
  createdAt: string; // ISO
  // only present on your own profile
  email?: string;
  emailVerified?: boolean;
}

/** A row in followers / following / blocked lists. */
export interface UserSummary {
  id: string;
  username: string;
  avatar: string | null;
  bio: string;
  isMe: boolean;
  isFollowing: boolean;
}

export interface UserListResult {
  users: UserSummary[];
  total: number | null;
  isLoading: boolean;
  error: AppError | null;
  refetch: () => Promise<unknown>;
  isRefetching: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

export const BIO_MAX_LENGTH = 160;
