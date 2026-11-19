import { router } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import { toAppError, useAuth } from '@/auth';
import {
  Button,
  errorMessage,
  FormError,
  Heading,
  Screen,
  TextField,
  validateEmail,
  validateNewPassword,
  validateUsername,
} from '@/components';

type Field = 'username' | 'email' | 'password';
type FieldErrors = Partial<Record<Field, string | null>>;

export default function RegisterScreen() {
  const register = useAuth((s) => s.register);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const [values, setValues] = useState<Record<Field, string>>({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const change = (field: Field) => (text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    if (errors[field]) setErrors((s) => ({ ...s, [field]: null }));
  };

  async function onSubmit() {
    if (pending) return;
    const next: FieldErrors = {
      username: validateUsername(values.username),
      email: validateEmail(values.email),
      password: validateNewPassword(values.password),
    };
    setErrors(next);
    setFormError(null);
    if (next.username || next.email || next.password) return;

    setPending(true);
    try {
      await register(values.username.trim(), values.email.trim(), values.password);
      // Signed in now; the root guard moves us to the app group.
    } catch (e) {
      setFormError(errorMessage(toAppError(e)));
      setPending(false);
    }
  }

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Heading title="Create account" subtitle="Join in a few seconds" />
      <FormError message={formError} />
      <TextField
        label="Username"
        value={values.username}
        onChangeText={change('username')}
        error={errors.username}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        maxLength={30}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
        editable={!pending}
      />
      <TextField
        ref={emailRef}
        label="Email"
        value={values.email}
        onChangeText={change('email')}
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
        value={values.password}
        onChangeText={change('password')}
        error={errors.password}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        editable={!pending}
      />
      <Button title="Create account" onPress={onSubmit} loading={pending} />
      <Button
        variant="link"
        title="Already have an account? Log in"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
      />
    </Screen>
  );
}
