import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { toAppError, useAuth, verifyEmail } from '@/auth';
import { Banner, Button, errorMessage, firstParam, Heading, isValidToken, Screen } from '@/components';
import { useTheme } from '@/theme';

type State = { kind: 'pending' } | { kind: 'success' } | { kind: 'error'; message: string };

// Reached via socialapp://verify-email?token=<64 hex> (or https://<host>/verify-email?token=…).
// Unguarded: works signed in or out. Submits the token automatically on mount.
export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = firstParam(params.token);
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const { colors, typography, spacing } = useTheme();

  const [state, setState] = useState<State>(() =>
    isValidToken(token)
      ? { kind: 'pending' }
      : {
          kind: 'error',
          message: token
            ? 'This verification link is malformed. Open the link from your email again.'
            : 'This verification link is missing its token. Open the link from your email again.',
        },
  );
  const submitted = useRef<string | null>(null);

  const submit = useCallback(async (t: string) => {
    setState({ kind: 'pending' });
    try {
      await verifyEmail(t);
      setState({ kind: 'success' });
    } catch (e) {
      setState({ kind: 'error', message: errorMessage(toAppError(e)) });
    }
  }, []);

  useEffect(() => {
    // Guard against double-submit (StrictMode effects, re-renders); re-run if a new token arrives.
    if (!isValidToken(token) || submitted.current === token) return;
    submitted.current = token;
    void submit(token);
  }, [token, submit]);

  // Once verified and signed in, refresh the user so Home drops the "unverified" banner.
  // Keyed on signedIn too: on a cold-start deep link bootstrap() may finish after verifyEmail().
  const refreshed = useRef(false);
  useEffect(() => {
    if (state.kind !== 'success' || !signedIn || refreshed.current) return;
    refreshed.current = true;
    useAuth
      .getState()
      .refreshUser()
      .catch(() => {});
  }, [state.kind, signedIn]);

  const leave = () => router.replace(signedIn ? '/' : '/login');

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      {state.kind === 'pending' ? (
        <View style={{ alignItems: 'center', gap: spacing.md }} accessibilityLiveRegion="polite" testID="verify-pending">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typography.body, { color: colors.text }]}>Verifying your email…</Text>
        </View>
      ) : state.kind === 'success' ? (
        <>
          <Heading title="Email verified" />
          <Banner tone="success" message="Thanks! Your email address is confirmed." testID="verify-success" />
          <Button title={signedIn ? 'Continue' : 'Go to log in'} onPress={leave} />
        </>
      ) : (
        <>
          <Heading title="Verification failed" />
          <Banner tone="error" message={state.message} testID="verify-error" />
          {isValidToken(token) ? (
            <Button title="Try again" variant="secondary" onPress={() => void submit(token)} />
          ) : null}
          <Button title={signedIn ? 'Go home' : 'Go to log in'} onPress={leave} />
        </>
      )}
    </Screen>
  );
}
