import { fireEvent, render, screen } from '@testing-library/react-native';

import VerifyEmailScreen from '@/app/verify-email';
import type { AppError } from '@/lib/contracts';

const mockVerify = jest.fn();
const mockRefreshUser = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string | string[] | undefined> = {};
const mockState = {
  status: 'signedOut' as 'signedOut' | 'signedIn',
  user: null,
  refreshUser: () => mockRefreshUser(),
};

jest.mock('@/auth', () => {
  const useAuth = (sel: (s: typeof mockState) => unknown) => sel(mockState);
  useAuth.getState = () => mockState;
  return {
    useAuth,
    verifyEmail: (t: string) => mockVerify(t),
    toAppError: (e: unknown) => e,
  };
});

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: { replace: (...a: unknown[]) => mockReplace(...a) },
}));

const TOKEN = 'a'.repeat(64);

const appError = (over: Partial<AppError>): AppError => ({
  status: 400,
  message: 'Invalid or expired verification token',
  isNetworkError: false,
  isRateLimited: false,
  ...over,
});

beforeEach(() => {
  mockVerify.mockReset();
  mockRefreshUser.mockReset().mockResolvedValue(undefined);
  mockReplace.mockReset();
  mockState.status = 'signedOut';
  mockParams = { token: TOKEN };
});

test('shows progress while the token is being verified', async () => {
  mockVerify.mockReturnValue(new Promise(() => {}));
  await render(<VerifyEmailScreen />);
  expect(screen.getByTestId('verify-pending')).toBeOnTheScreen();
  expect(mockVerify).toHaveBeenCalledWith(TOKEN);
  expect(mockVerify).toHaveBeenCalledTimes(1);
});

test('signed out: shows success and offers log in', async () => {
  mockVerify.mockResolvedValue(undefined);
  await render(<VerifyEmailScreen />);
  expect(await screen.findByTestId('verify-success')).toBeOnTheScreen();
  expect(mockRefreshUser).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Go to log in' }));
  expect(mockReplace).toHaveBeenCalledWith('/login');
});

test('signed in: refreshes the user on success', async () => {
  mockState.status = 'signedIn';
  mockVerify.mockResolvedValue(undefined);
  await render(<VerifyEmailScreen />);
  expect(await screen.findByTestId('verify-success')).toBeOnTheScreen();
  expect(mockRefreshUser).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(mockReplace).toHaveBeenCalledWith('/');
});

test('shows the server error and allows retry', async () => {
  mockVerify.mockRejectedValueOnce(appError({})).mockResolvedValueOnce(undefined);
  await render(<VerifyEmailScreen />);
  expect(await screen.findByText('Invalid or expired verification token')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByTestId('verify-success')).toBeOnTheScreen();
  expect(mockVerify).toHaveBeenCalledTimes(2);
});

test('shows a distinct network error message', async () => {
  mockVerify.mockRejectedValue(appError({ status: null, message: 'Network Error', isNetworkError: true }));
  await render(<VerifyEmailScreen />);
  expect(await screen.findByText(/can't reach the server/i)).toBeOnTheScreen();
});

test('missing token: explains the problem without calling the API', async () => {
  mockParams = {};
  await render(<VerifyEmailScreen />);
  expect(screen.getByText(/missing its token/i)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  expect(mockVerify).not.toHaveBeenCalled();
});

test('malformed token: explains the problem without calling the API', async () => {
  mockParams = { token: 'not-a-real-token' };
  await render(<VerifyEmailScreen />);
  expect(screen.getByText(/malformed/i)).toBeOnTheScreen();
  expect(mockVerify).not.toHaveBeenCalled();
});
