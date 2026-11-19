import type { AppError } from '@/lib/contracts';

// Client-side mirrors of the backend validation rules (src/api/v2).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_]+$/;
const TOKEN_RE = /^[a-f0-9]{64}$/i;

export const MIN_PASSWORD = 6;

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return 'Email is required';
  if (!EMAIL_RE.test(v)) return 'Enter a valid email address';
  return null;
}

export function validateUsername(username: string): string | null {
  const v = username.trim();
  if (!v) return 'Username is required';
  if (v.length < 3 || v.length > 30) return 'Username must be 3–30 characters';
  if (!USERNAME_RE.test(v)) return 'Only letters, numbers and underscores';
  return null;
}

/** For new passwords (register / reset). */
export function validateNewPassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters`;
  return null;
}

export function isValidToken(token: string | null | undefined): token is string {
  return !!token && TOKEN_RE.test(token);
}

/** Normalises an Expo Router search param (string | string[] | undefined). */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check your connection and try again.";

/** Text to show in a FormError for a failed request. Network errors get a distinct message. */
export function errorMessage(err: AppError): string {
  if (err.isNetworkError) return NETWORK_ERROR_MESSAGE;
  if (err.isRateLimited) return err.message || 'Too many attempts. Please wait a moment and try again.';
  return err.message || 'Something went wrong. Please try again.';
}
