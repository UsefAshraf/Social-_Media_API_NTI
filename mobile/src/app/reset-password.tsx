import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import { resetPassword, toAppError, useAuth } from '@/auth';
import {
  Banner,
  Button,
  errorMessage,
  firstParam,
  FormError,
  Heading,
  isValidToken,
  Screen,
  TextField,
  validateNewPassword,
} from '@/components';

// Reached via socialapp://reset-password?token=<64 hex> (or https://<host>/reset-password?token=…).
// Unguarded: works signed in or out.
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = firstParam(params.token);
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const confirmRef = useRef<TextInputInstance>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const leave = () => router.replace(signedIn ? '/' : '/login');

  if (!isValidToken(token)) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <Heading title="Invalid reset link" />
        <Banner
          tone="error"
          testID="token-error"
          message={
            token
              ? 'This password reset link is malformed. Open the link from your email again, or request a new one.'
              : 'This password reset link is missing its token. Open the link from your email again, or request a new one.'
          }
        />
        {signedIn ? (
          <Button title="Go home" onPress={leave} />
        ) : (
          <Button title="Request a new link" onPress={() => router.replace('/forgot-password')} />
        )}
      </Screen>
    );
  }

  async function onSubmit() {
    if (pending || !isValidToken(token)) return;
    const next = {
      password: validateNewPassword(password),
      confirm: confirm === password ? null : 'Passwords do not match',
    };
    setErrors(next);
    setFormError(null);
    if (next.password || next.confirm) return;

    setPending(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setFormError(errorMessage(toAppError(e)));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <Heading title="Password updated" />
        <Banner tone="success" message="Your password has been reset." testID="reset-done" />
        <Button title={signedIn ? 'Continue' : 'Go to log in'} onPress={leave} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Heading title="Choose a new password" />
      <FormError message={formError} />
      <TextField
        label="New password"
        secure
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (errors.password) setErrors((s) => ({ ...s, password: null }));
        }}
        error={errors.password}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
        editable={!pending}
      />
      <TextField
        ref={confirmRef}
        label="Confirm password"
        secure
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t);
          if (errors.confirm) setErrors((s) => ({ ...s, confirm: null }));
        }}
        error={errors.confirm}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        editable={!pending}
      />
      <Button title="Reset password" onPress={onSubmit} loading={pending} />
    </Screen>
  );
}
