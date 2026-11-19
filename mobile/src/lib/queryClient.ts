import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { toAppError } from '@/api/errors';
import { useAuth } from '@/auth';

const MAX_RETRIES = 2;

/** Retries network errors, timeouts, 429 and 5xx — never other 4xx (they won't change on retry). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  const { status } = toAppError(error);
  if (status === null) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: { retry: false },
    },
  });
}

/** The app's QueryClient — pass it to <QueryClientProvider> in the root layout. */
export const queryClient = createQueryClient();

// React Native has no window focus: refetch stale queries when the app returns to the foreground.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
    return () => sub.remove();
  });
}

// Cached posts carry per-viewer state (likedByMe, isMine, bookmarked): drop everything when the user changes.
useAuth.subscribe((state, prev) => {
  if (state.user?.id !== prev.user?.id) queryClient.clear();
});
