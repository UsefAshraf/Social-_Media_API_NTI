import { router } from 'expo-router';
import { useState } from 'react';

import { requestPasswordReset, toAppError } from '@/auth';
import { Banner, Button, errorMessage, FormError, Heading, Screen, TextField, validateEmail } from '@/components';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    if (pending) return;
    const err = validateEmail(email);
    setError(err);
    setFormError(null);
    if (err) return;

    setPending(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setFormError(errorMessage(toAppError(e)));
    } finally {
      setPending(false);
    }
  }

  const backToLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  if (sent) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <Heading title="Check your email" />
        <Banner
          tone="success"
          message={`If an account exists for ${email.trim()}, we sent a link to reset your password.`}
          testID="reset-sent"
        />
        <Button title="Back to log in" onPress={backToLogin} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Heading title="Forgot password" subtitle="Enter your email and we'll send you a reset link." />
      <FormError message={formError} />
      <TextField
        label="Email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (error) setError(null);
        }}
        error={error}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={onSubmit}
        editable={!pending}
      />
      <Button title="Send reset link" onPress={onSubmit} loading={pending} />
      <Button variant="link" title="Back to log in" onPress={backToLogin} />
    </Screen>
  );
}
