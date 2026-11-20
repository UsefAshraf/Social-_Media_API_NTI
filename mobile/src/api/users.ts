// Users / profiles / following endpoints + mapping from raw backend documents to the UI shapes in '@/lib/users'.
// Every function throws AppError on failure.
import type { PickedImage } from '@/lib/posts';
import type { Profile, UserSummary } from '@/lib/users';

import { api, http } from './client';
import { toAppError } from './errors';
import { idOf, imageFilePart, multipartConfig, resolveMediaUrl } from './posts';
import type { RawPagination, UploadOptions } from './posts';

// ---------------------------------------------------------------------------
// Raw shapes (loose on purpose: older payloads lack counts / flags)
// ---------------------------------------------------------------------------

type RawRef = string | { _id?: unknown; id?: unknown } | null | undefined;

export interface RawProfile {
  _id?: string;
  id?: string;
  username?: string;
  avatar?: string | null;
  bio?: string | null;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  isMe?: boolean;
  isFollowing?: boolean;
  followsYou?: boolean;
  createdAt?: string;
  followers?: RawRef[];
  following?: RawRef[];
  // own profile only
  email?: string;
  emailVerified?: boolean;
  role?: string;
}

export interface RawUserSummary {
  _id?: string;
  id?: string;
  username?: string;
  avatar?: string | null;
  bio?: string | null;
  isFollowing?: boolean;
  isMe?: boolean;
}

interface UserListEnvelope {
  data?: RawUserSummary[];
  pagination?: RawPagination;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

const ids = (refs: RawRef[] | undefined): string[] | null => (Array.isArray(refs) ? refs.map(idOf) : null);
const count = (value: unknown, fallback: string[] | null): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : (fallback?.length ?? 0);

export function mapProfile(raw: RawProfile, viewerId: string | null | undefined): Profile {
  const id = idOf(raw._id ?? raw.id);
  const followers = ids(raw.followers);
  const following = ids(raw.following);
  const isMe = typeof raw.isMe === 'boolean' ? raw.isMe : !!viewerId && id === viewerId;
  const isFollowing =
    !isMe && (typeof raw.isFollowing === 'boolean' ? raw.isFollowing : !!viewerId && !!followers?.includes(viewerId));
  const followsYou =
    !isMe && (typeof raw.followsYou === 'boolean' ? raw.followsYou : !!viewerId && !!following?.includes(viewerId));

  const profile: Profile = {
    id,
    username: raw.username ?? '',
    avatar: resolveMediaUrl(raw.avatar),
    bio: typeof raw.bio === 'string' ? raw.bio : '',
    followersCount: count(raw.followersCount, followers),
    followingCount: count(raw.followingCount, following),
    postsCount: count(raw.postsCount, null),
    isMe,
    isFollowing,
    followsYou,
    createdAt: raw.createdAt ?? '',
  };
  if (isMe) {
    if (typeof raw.email === 'string') profile.email = raw.email;
    if (typeof raw.emailVerified === 'boolean') profile.emailVerified = raw.emailVerified;
    else if (typeof raw.email === 'string') profile.emailVerified = false;
  }
  return profile;
}

export function mapUserSummary(raw: RawUserSummary, viewerId: string | null | undefined): UserSummary {
  const id = idOf(raw._id ?? raw.id);
  const isMe = typeof raw.isMe === 'boolean' ? raw.isMe : !!viewerId && id === viewerId;
  return {
    id,
    username: raw.username ?? '',
    avatar: resolveMediaUrl(raw.avatar),
    bio: typeof raw.bio === 'string' ? raw.bio : '',
    isMe,
    isFollowing: !isMe && raw.isFollowing === true,
  };
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

const userPath = (userId: string) => `/users/${encodeURIComponent(userId)}`;

/** GET /users/profile — the viewer's own profile (includes email / emailVerified). */
export async function getMyProfile(viewerId: string | null | undefined): Promise<Profile> {
  return mapProfile(await http.get<RawProfile>('/users/profile'), viewerId);
}

/** The viewer's own id goes to /users/profile (own-only fields), anyone else to GET /users/:id. 404 = missing or blocked. */
export async function getProfile(userId: string, viewerId: string | null | undefined): Promise<Profile> {
  if (viewerId && userId === viewerId) return getMyProfile(viewerId);
  return mapProfile(await http.get<RawProfile>(userPath(userId)), viewerId);
}

export interface UpdateProfileInput {
  username?: string;
  email?: string;
  bio?: string;
  /** PickedImage = replace, null = remove, undefined = keep. */
  avatar?: PickedImage | null;
}

/** Multipart body: the text fields that are set + file field `image`. */
export function buildProfileFormData(input: UpdateProfileInput, image: PickedImage): FormData {
  const form = new FormData();
  if (input.username !== undefined) form.append('username', input.username);
  if (input.email !== undefined) form.append('email', input.email);
  if (input.bio !== undefined) form.append('bio', input.bio);
  form.append('image', imageFilePart(image, 'avatar'));
  return form;
}

/** PATCH /users/profile — JSON, or multipart (`image`) when a new avatar is attached. 400 'Username already exists'. */
export async function updateProfile(
  input: UpdateProfileInput,
  viewerId: string | null | undefined,
  opts?: UploadOptions,
): Promise<Profile> {
  let raw: RawProfile;
  if (input.avatar) {
    raw = await http.patch<RawProfile>('/users/profile', buildProfileFormData(input, input.avatar), multipartConfig(opts));
  } else {
    const body: { username?: string; email?: string; bio?: string; avatar?: string } = {};
    if (input.username !== undefined) body.username = input.username;
    if (input.email !== undefined) body.email = input.email;
    if (input.bio !== undefined) body.bio = input.bio;
    if (input.avatar === null) body.avatar = '';
    raw = await http.patch<RawProfile>('/users/profile', body);
  }
  return mapProfile(raw, viewerId);
}

// ---------------------------------------------------------------------------
// Follow / block
// ---------------------------------------------------------------------------

export interface FollowResult {
  following: boolean;
  /** The target's follower count (undefined on older backends). */
  followersCount?: number;
  /** The viewer's following count (undefined on older backends). */
  followingCount?: number;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : undefined);

function mapFollowResult(raw: Partial<Record<keyof FollowResult, unknown>> | undefined, fallback: boolean): FollowResult {
  return {
    following: typeof raw?.following === 'boolean' ? raw.following : fallback,
    followersCount: num(raw?.followersCount),
    followingCount: num(raw?.followingCount),
  };
}

/** POST /users/:id/follow. 400 = yourself, 403 = blocked, 404. */
export async function followUser(userId: string): Promise<FollowResult> {
  return mapFollowResult(await http.post(`${userPath(userId)}/follow`), true);
}

/** DELETE /users/:id/follow */
export async function unfollowUser(userId: string): Promise<FollowResult> {
  return mapFollowResult(await http.delete(`${userPath(userId)}/follow`), false);
}

/** POST /users/:id/block — also removes follows both ways. */
export async function blockUser(userId: string): Promise<void> {
  await http.post(`${userPath(userId)}/block`);
}

/** DELETE /users/:id/block */
export async function unblockUser(userId: string): Promise<void> {
  await http.delete(`${userPath(userId)}/block`);
}

// ---------------------------------------------------------------------------
// Lists (page-based)
// ---------------------------------------------------------------------------

export const USER_PAGE_SIZE = 20;

export interface UserPage {
  users: UserSummary[];
  /** Next page number, null = last page. */
  nextPage: number | null;
  total: number | null;
}

async function getUserList(url: string, page: number, viewerId: string | null | undefined): Promise<UserPage> {
  try {
    const res = await api.get<UserListEnvelope>(url, { params: { page, limit: USER_PAGE_SIZE } });
    const raw = Array.isArray(res.data?.data) ? res.data.data : [];
    const p = res.data?.pagination;
    const current = typeof p?.page === 'number' ? p.page : page;
    const nextPage = raw.length > 0 && typeof p?.pages === 'number' && current < p.pages ? current + 1 : null;
    return {
      users: raw.map((u) => mapUserSummary(u, viewerId)),
      nextPage,
      total: typeof p?.total === 'number' ? p.total : null,
    };
  } catch (e) {
    throw toAppError(e);
  }
}

/** GET /users/:id/followers — newest first. */
export const getFollowers = (userId: string, page: number, viewerId: string | null | undefined) =>
  getUserList(`${userPath(userId)}/followers`, page, viewerId);

/** GET /users/:id/following — newest first. */
export const getFollowing = (userId: string, page: number, viewerId: string | null | undefined) =>
  getUserList(`${userPath(userId)}/following`, page, viewerId);

/** GET /users/blocked */
export const getBlockedUsers = (page: number, viewerId: string | null | undefined) =>
  getUserList('/users/blocked', page, viewerId);
