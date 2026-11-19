// Shared shapes between the data layer (src/api, src/auth) and the UI (src/app, src/components).
// Matches the backend in src/api/v2 — change both together.

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string | null;
  bio?: string;
  emailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Every failed request is normalised to this. */
export interface AppError {
  status: number | null; // null = network error / no response
  message: string;
  isNetworkError: boolean;
  isRateLimited: boolean; // 429
}

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
