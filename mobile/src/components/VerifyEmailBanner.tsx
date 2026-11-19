import { useState } from 'react';

import { resendVerification, toAppError } from '@/auth';

import { Banner } from './Banner';
import { Button } from './Button';
import { errorMessage } from './forms';

/** "Verify your email" warning with a Resend action. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onResend() {
    if (pending) return;
    setPending(true);
    setResult(null);
    try {
      await resendVerification();
      setResult({ ok: true, message: `Verification email sent to ${email}.` });
    } catch (e) {
      // errorMessage() surfaces the server's 429 message ("try again later") when rate-limited.
      setResult({ ok: false, message: errorMessage(toAppError(e)) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Banner
      tone="warning"
      title="Verify your email"
      message={`Check ${email} for a verification link.`}
      testID="verify-banner"
    >
      {result ? (
        <Banner tone={result.ok ? 'success' : 'error'} message={result.message} testID="resend-result" />
      ) : null}
      <Button variant="link" title="Resend email" onPress={onResend} loading={pending} />
    </Banner>
  );
}
