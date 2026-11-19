import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { type TextInputInstance, View } from 'react-native';

import { toAppError, useAuth } from '@/auth';
import { Button, errorMessage, FormError, Heading, Screen, TextField, validateEmail } from '@/components';
import { useTheme } from '@/theme';

interface FieldErrors {
  email?: string | null;
  password?: string | null;
}

export default function LoginScreen() {
  const login = useAuth((s) => s.login);
  const { spacing } = useTheme();
  const passwordRef = useRef<TextInputInstance>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    if (pending) return;
    const next: FieldErrors = {
      email: validateEmail(email),
      password: password ? null : 'Password is required',
    };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return;

    setPending(true);
    try {
      await login(email.trim(), password);
      // On success the root guard swaps the auth group for the app group.
    } catch (e) {
      setFormError(errorMessage(toAppError(e)));
      setPending(false);
    }
  }

  return (
    <Screen centered>
      <Heading title="Welcome back" subtitle="Log in to your account" />
      <FormError message={formError} />
      <TextField
        label="Email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (errors.email) setErrors((s) => ({ ...s, email: null }));
        }}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!pending}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        secure
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (errors.password) setErrors((s) => ({ ...s, password: null }));
        }}
        error={errors.password}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        editable={!pending}
      />
      <Button title="Log in" onPress={onSubmit} loading={pending} />
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Button variant="link" title="Forgot password?" onPress={() => router.push('/forgot-password')} />
        <Button variant="link" title="Create an account" onPress={() => router.push('/register')} />
      </View>
    </Screen>
  );
}
