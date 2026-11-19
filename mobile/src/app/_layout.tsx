import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '@/auth';
import { queryClient } from '@/lib/queryClient';
import { useTheme } from '@/theme';

export default function RootLayout() {
  useEffect(() => {
    void useAuth.getState().bootstrap();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const status = useAuth((s) => s.status);
  const { colors, scheme } = useTheme();
  const signedIn = status === 'signedIn';
  useRestoreDeepLink(status);

  // The navigator is always mounted (so the initial / deep-link URL is kept);
  // while the session is being restored a splash overlay covers it.
  // 'loading' counts as signed-out for the guards, so a cold start on "/" settles
  // on /login and moves to "/" once bootstrap() resolves to signedIn — never a loop.
  // App deep links (e.g. /post/123) are restored after that by useRestoreDeepLink.
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={signedIn} redirectTo="/login">
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn} redirectTo="/">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        {/* Deep-link targets, reachable signed in or out. */}
        <Stack.Screen name="reset-password" options={{ headerShown: true, title: 'Reset password' }} />
        <Stack.Screen name="verify-email" options={{ headerShown: true, title: 'Verify email' }} />
      </Stack>
      {status === 'loading' ? (
        <View
          style={[StyleSheet.absoluteFill, styles.splash, { backgroundColor: colors.background }]}
          accessibilityLabel="Loading"
          testID="splash"
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

// Paths that are never "remembered": the (auth) group, home, and the unguarded deep links
// (those stay put on their own).
const AUTH_PATHS = new Set(['/login', '/register', '/forgot-password']);
const NOT_RESTORED = new Set(['/', '/reset-password', '/verify-email', ...AUTH_PATHS]);

/**
 * A cold start on an app deep link (e.g. socialapp://post/123) is sent to /login by the guard
 * while the session is restored; once bootstrap() resolves to signedIn, go back to that link
 * instead of landing on Home.
 */
function useRestoreDeepLink(status: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  // Captured on the first render, before any guard redirect.
  const [initial] = useState(() => {
    if (status !== 'loading' || NOT_RESTORED.has(pathname)) return null;
    const segments = new Set(pathname.split('/').map((s) => safeDecode(s)));
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      const value = Array.isArray(v) ? v[0] : v;
      // Dynamic segments (e.g. [id]) are already in the pathname.
      if (typeof value === 'string' && !segments.has(value)) query[k] = value;
    }
    return { pathname, params: query };
  });
  const done = useRef(false);

  useEffect(() => {
    if (!initial || done.current || status === 'loading') return;
    if (status === 'signedOut') {
      done.current = true; // a later login lands on Home as usual
      return;
    }
    // Wait for the (auth) guard's own redirect to "/" to happen first, or it would win.
    if (AUTH_PATHS.has(pathname)) return;
    done.current = true;
    router.replace(initial);
  }, [initial, status, pathname, router]);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: { alignItems: 'center', justifyContent: 'center' },
});
