/// <reference types="jest" />
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { mapProfile, mapUserSummary } from '@/api/users';
import type { RawProfile, RawUserSummary } from '@/api/users';
import { ME } from '@/features/posts/__testutils__/fixtures';
import type { Profile, UserSummary } from '@/lib/users';

import type { UserListData } from '../cache';

export function rawProfile(overrides: Partial<RawProfile> = {}): RawProfile {
  return {
    _id: 'u-other',
    username: 'other',
    avatar: '',
    bio: '',
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    isMe: false,
    isFollowing: false,
    followsYou: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    followers: [],
    following: [],
    ...overrides,
  };
}

export const rawMe = (overrides: Partial<RawProfile> = {}): RawProfile =>
  rawProfile({ _id: ME, username: 'me', isMe: true, email: 'me@x.io', emailVerified: true, role: 'user', ...overrides });

export const profile = (overrides: Partial<RawProfile> = {}): Profile => mapProfile(rawProfile(overrides), ME);
export const myProfile = (overrides: Partial<RawProfile> = {}): Profile => mapProfile(rawMe(overrides), ME);

export const rawSummary = (id: string, overrides: Partial<RawUserSummary> = {}): RawUserSummary => ({
  _id: id,
  username: id,
  avatar: '',
  bio: '',
  isFollowing: false,
  isMe: false,
  ...overrides,
});

export const summary = (id: string, overrides: Partial<RawUserSummary> = {}): UserSummary =>
  mapUserSummary(rawSummary(id, overrides), ME);

export function seedUsers(qc: QueryClient, key: QueryKey, users: UserSummary[]): void {
  qc.setQueryData<UserListData>(key, { pages: [{ users, nextPage: null, total: users.length }], pageParams: [1] });
}

export function listUsers(qc: QueryClient, key: QueryKey): UserSummary[] | undefined {
  return qc.getQueryData<UserListData>(key)?.pages.flatMap((p) => p.users);
}
