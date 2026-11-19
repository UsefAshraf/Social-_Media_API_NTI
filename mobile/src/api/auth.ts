import type { AuthTokens, User } from '@/lib/contracts';

import { http, refreshSession } from './client';
import { makeAppError } from './errors';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokenStorage';

/** Raw user as the backend sends it: auth responses use `id`, /users/profile sends the Mongo doc with `_id`. */
export interface RawUser {
  id?: string;
  _id?: string;
  username?: string;
  email?: string;
  avatar?: string | null;
  bio?: string;
  emailVerified?: boolean;
  [key: string]: unknown;
}

export function mapUser(raw: RawUser): User {
  const id = raw.id ?? raw._id;
  if (!id) throw makeAppError('Invalid user data from server.', null);
  const user: User = {
    id: String(id),
    username: raw.username ?? '',
    email: raw.email ?? '',
    avatar: raw.avatar ?? null,
    emailVerified: Boolean(raw.emailVerified),
  };
  if (typeof raw.bio === 'string') user.bio = raw.bio;
  return user;
}

interface AuthPayload extends AuthTokens {
  user: RawUser;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

async function handleAuthPayload(payload: AuthPayload): Promise<AuthResult> {
  if (!payload?.accessToken || !payload?.refreshToken || !payload.user) {
    throw makeAppError('Invalid response from server.', null);
  }
  const tokens = { accessToken: payload.accessToken, refreshToken: payload.refreshToken };
  await setTokens(tokens);
  return { user: mapUser(payload.user), tokens };
}

/** POST /auth/login — stores tokens on success. */
export async function login(email: string, password: string): Promise<AuthResult> {
  const data = await http.post<AuthPayload>('/auth/login', { email: email.trim(), password });
  return handleAuthPayload(data);
}

/** POST /auth/register — stores tokens on success. */
export async function register(username: string, email: string, password: string): Promise<AuthResult> {
  const data = await http.post<AuthPayload>('/auth/register', {
    username: username.trim(),
    email: email.trim(),
    password,
  });
  return handleAuthPayload(data);
}

/** POST /auth/logout — best effort; local tokens are always cleared. Never throws. */
export async function logout(): Promise<void> {
  try {
    if (getAccessToken() || (await getRefreshToken())) {
      await http.post<unknown>('/auth/logout');
    }
  } catch {
    // ignore: server may be unreachable or the session already gone
  } finally {
    await clearTokens();
  }
}

/** Single-flight token refresh (shared with the 401 interceptor). Resolves the new access token. */
export function refresh(): Promise<string> {
  return refreshSession();
}

/** GET /users/profile → mapped User (`_id` → `id`). */
export async function getMe(): Promise<User> {
  const raw = await http.get<RawUser>('/users/profile');
  return mapUser(raw);
}

/** GET /auth/reset?email= — always succeeds for any email (doesn't reveal existence). */
export async function requestPasswordReset(email: string): Promise<void> {
  await http.get<unknown>('/auth/reset', { params: { email: email.trim() } });
}

/** POST /auth/reset */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await http.post<unknown>('/auth/reset', { token: token.trim(), newPassword });
}

/** POST /auth/verify-email — token is 64 hex chars. */
export async function verifyEmail(token: string): Promise<void> {
  const t = token.trim();
  if (!/^[a-f0-9]{64}$/i.test(t)) {
    throw makeAppError('Invalid verification link.', 400);
  }
  await http.post<unknown>('/auth/verify-email', { token: t });
}

/** POST /auth/resend-verification (requires sign-in). */
export async function resendVerification(): Promise<void> {
  await http.post<unknown>('/auth/resend-verification');
}
