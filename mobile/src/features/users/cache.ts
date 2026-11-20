// Helpers that keep one user consistent across their profile cache and every cached user list.
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { UserPage } from '@/api/users';
import { useAuth } from '@/auth';
import type { User } from '@/lib/contracts';
import type { Profile, UserSummary } from '@/lib/users';

import { userKeys } from './keys';

export type UserListData = InfiniteData<UserPage, number>;

function isListData(data: unknown): data is UserListData {
  return !!data && typeof data === 'object' && Array.isArray((data as UserListData).pages);
}

/** Applies `updater` to a cached profile (no-op if it isn't cached). Returning the same object leaves it untouched. */
export function updateProfileCache(qc: QueryClient, userId: string, updater: (p: Profile) => Profile): void {
  if (!userId) return;
  qc.setQueryData<Profile>(userKeys.profile(userId), (p) => (p ? updater(p) : p));
}

/** Applies `updater` to the user's row in every cached followers / following / blocked page. */
export function updateUserInLists(qc: QueryClient, userId: string, updater: (u: UserSummary) => UserSummary): void {
  qc.setQueriesData<UserListData>({ queryKey: userKeys.lists() }, (data) => {
    if (!isListData(data)) return data;
    let changed = false;
    const pages = data.pages.map((page) => {
      if (!page.users.some((u) => u.id === userId)) return page;
      let pageChanged = false;
      const users = page.users.map((u) => {
        if (u.id !== userId) return u;
        const next = updater(u);
        if (next !== u) pageChanged = true;
        return next;
      });
      if (!pageChanged) return page;
      changed = true;
      return { ...page, users };
    });
    return changed ? { ...data, pages } : data;
  });
}

/** Removes the user from every cached list (and lowers that list's total). */
export function removeUserFromLists(qc: QueryClient, userId: string): void {
  qc.setQueriesData<UserListData>({ queryKey: userKeys.lists() }, (data) => {
    if (!isListData(data)) return data;
    if (!data.pages.some((page) => page.users.some((u) => u.id === userId))) return data;
    const pages = data.pages.map((page) => ({
      ...page,
      users: page.users.filter((u) => u.id !== userId),
      total: page.total === null ? null : Math.max(0, page.total - 1),
    }));
    return { ...data, pages };
  });
}

/** Whether the viewer follows `userId`, per the freshest cache: the profile first, then any list row. */
export function readFollowing(qc: QueryClient, userId: string): boolean | undefined {
  const profile = qc.getQueryData<Profile>(userKeys.profile(userId));
  if (profile) return profile.isFollowing;
  for (const [, data] of qc.getQueriesData<UserListData>({ queryKey: userKeys.lists() })) {
    if (!isListData(data)) continue;
    for (const page of data.pages) {
      const hit = page.users.find((u) => u.id === userId);
      if (hit) return hit.isFollowing;
    }
  }
  return undefined;
}

/**
 * Cancels in-flight fetches of these profiles and of user lists containing `rowUserId`, so a response started
 * before an optimistic update can't overwrite it. Queries without data (first loads) are left alone.
 */
export function cancelUserQueries(qc: QueryClient, profileIds: string[], rowUserId: string): Promise<void> {
  const profileKeys = new Set(profileIds.filter(Boolean).map((id) => JSON.stringify(userKeys.profile(id))));
  return qc.cancelQueries({
    queryKey: userKeys.all,
    predicate: (q) => {
      if (q.state.fetchStatus !== 'fetching' || q.state.data === undefined) return false;
      if (profileKeys.has(JSON.stringify(q.queryKey))) return true;
      return isListData(q.state.data) && q.state.data.pages.some((page) => page.users.some((u) => u.id === rowUserId));
    },
  });
}

/** Flattens infinite pages and drops duplicates (pages shift when someone follows while you scroll). */
export function flattenUsers(data: UserListData): { users: UserSummary[]; total: number | null } {
  const seen = new Set<string>();
  const users: UserSummary[] = [];
  for (const page of data.pages) {
    for (const u of page.users) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      users.push(u);
    }
  }
  const total = data.pages.length ? data.pages[data.pages.length - 1].total : null;
  return { users, total };
}

/** Copies the own-profile fields the auth store keeps (username, avatar, bio, email, emailVerified) into it. */
export function syncAuthUser(profile: Profile): void {
  const { user, setUser } = useAuth.getState();
  if (!user || user.id !== profile.id) return;
  const next: User = {
    ...user,
    username: profile.username,
    avatar: profile.avatar,
    bio: profile.bio,
    email: profile.email ?? user.email,
    emailVerified: profile.emailVerified ?? user.emailVerified,
  };
  const same = (Object.keys(next) as (keyof User)[]).every((k) => next[k] === user[k]);
  if (!same) setUser(next);
}
