import { fireEvent, render, screen } from '@testing-library/react-native';

import LoginScreen from '@/app/(auth)/login';
import type { AppError } from '@/lib/contracts';

const mockLogin = jest.fn();

jest.mock('@/auth', () => {
  const state = { status: 'signedOut', user: null, login: (...a: unknown[]) => mockLogin(...a) };
  const useAuth = (sel: (s: typeof state) => unknown) => sel(state);
  useAuth.getState = () => state;
  return { useAuth, toAppError: (e: unknown) => e };
});

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }));

const appError = (over: Partial<AppError>): AppError => ({
  status: 400,
  message: 'Bad request',
  isNetworkError: false,
  isRateLimited: false,
  ...over,
});

beforeEach(() => mockLogin.mockReset());

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

const submit = () => fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

test('shows required-field errors and does not call login', async () => {
  await render(<LoginScreen />);
  await submit();
  expect(screen.getByText('Email is required')).toBeOnTheScreen();
  expect(screen.getByText('Password is required')).toBeOnTheScreen();
  expect(mockLogin).not.toHaveBeenCalled();
});

test('rejects a malformed email', async () => {
  await render(<LoginScreen />);
  await fill('not-an-email', 'secret1');
  await submit();
  expect(screen.getByText('Enter a valid email address')).toBeOnTheScreen();
  expect(mockLogin).not.toHaveBeenCalled();
});

test('clears a field error as the user types', async () => {
  await render(<LoginScreen />);
  await submit();
  await fireEvent.changeText(screen.getByLabelText('Email'), 'a');
  expect(screen.queryByText('Email is required')).toBeNull();
});

test('submits trimmed email and password when valid', async () => {
  mockLogin.mockResolvedValue(undefined);
  await render(<LoginScreen />);
  await fill('  ann@example.com ', 'secret1');
  await submit();
  expect(mockLogin).toHaveBeenCalledWith('ann@example.com', 'secret1');
  expect(screen.queryByTestId('form-error')).toBeNull();
});

test('shows the server message on failure', async () => {
  mockLogin.mockRejectedValue(appError({ status: 401, message: 'Invalid email or password' }));
  await render(<LoginScreen />);
  await fill('ann@example.com', 'wrong12');
  await submit();
  expect(await screen.findByText('Invalid email or password')).toBeOnTheScreen();
});

test('shows a distinct message for network errors', async () => {
  mockLogin.mockRejectedValue(appError({ status: null, message: 'Network Error', isNetworkError: true }));
  await render(<LoginScreen />);
  await fill('ann@example.com', 'secret1');
  await submit();
  expect(await screen.findByText(/can't reach the server/i)).toBeOnTheScreen();
  expect(screen.queryByText('Network Error')).toBeNull();
});

test('disables the submit button while the request is pending', async () => {
  mockLogin.mockReturnValue(new Promise(() => {}));
  await render(<LoginScreen />);
  await fill('ann@example.com', 'secret1');
  await submit();
  expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled();
  await submit();
  expect(mockLogin).toHaveBeenCalledTimes(1);
});
