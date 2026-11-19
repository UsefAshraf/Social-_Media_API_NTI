import { create } from 'zustand';

import * as authApi from '@/api/auth';
import { setOnSessionExpired } from '@/api/client';
import { toAppError } from '@/api/errors';
import { clearTokens, getRefreshToken } from '@/api/tokenStorage';
import type { AuthStatus, User } from '@/lib/contracts';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** On app start: refresh token → refresh → getMe → signedIn, else signedOut. Never throws. */
  bootstrap(): Promise<void>;
  /** Throws AppError. */
  login(email: string, password: string): Promise<void>;
  /** Throws AppError. */
  register(username: string, email: string, password: string): Promise<void>;
  /** Best-effort server call, always clears locally. Never throws. */
  logout(): Promise<void>;
  /** Re-fetch /users/profile (e.g. after verifying email). Throws AppError. */
  refreshUser(): Promise<void>;
  setUser(user: User): void;
}

let bootstrapInFlight: Promise<void> | null = null;

export const useAuth = create<AuthState>()((set) => ({
  status: 'loading',
  user: null,

  bootstrap() {
    if (!bootstrapInFlight) {
      bootstrapInFlight = (async () => {
        try {
          const refreshToken = await getRefreshToken();
          if (!refreshToken) {
            set({ status: 'signedOut', user: null });
            return;
          }
          await authApi.refresh();
          const user = await authApi.getMe();
          set({ status: 'signedIn', user });
        } catch {
          // Rejected refresh already cleared tokens. On transient failures (offline, 5xx) the
          // refresh token is kept, so a later bootstrap() can still restore the session.
          set({ status: 'signedOut', user: null });
        }
      })().finally(() => {
        bootstrapInFlight = null;
      });
    }
    return bootstrapInFlight;
  },

  async login(email, password) {
    try {
      const { user } = await authApi.login(email, password);
      set({ status: 'signedIn', user });
    } catch (e) {
      throw toAppError(e);
    }
  },

  async register(username, email, password) {
    try {
      const { user } = await authApi.register(username, email, password);
      set({ status: 'signedIn', user });
    } catch (e) {
      throw toAppError(e);
    }
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      await clearTokens();
    }
    set({ status: 'signedOut', user: null });
  },

  async refreshUser() {
    try {
      const user = await authApi.getMe();
      set({ user });
    } catch (e) {
      throw toAppError(e);
    }
  },

  setUser(user) {
    set({ user });
  },
}));

// Session could not be refreshed (refresh token rejected) → sign out everywhere.
setOnSessionExpired(() => {
  useAuth.setState({ status: 'signedOut', user: null });
});
