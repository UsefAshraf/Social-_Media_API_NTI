/// <reference types="jest" />
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert, type AlertButton } from 'react-native';

// Exercises the real src/app tree: Stack.Protected guards in the root layout, the (app) stack
// over the bottom tabs, and the unguarded deep-link routes. @/auth is replaced by a real zustand
// store we can drive; the posts data layer is stubbed.
jest.mock('@/auth', () => {
  const { create } = jest.requireActual('zustand');
  const useAuth = create(() => ({
    status: 'loading',
    user: null,
    bootstrap: async () => {},
    login: jest.fn(),
    register: jest.fn(),
    logout: async () => useAuth.setState({ status: 'signedOut', user: null }),
    refreshUser: jest.fn(async () => {}),
    setUser: jest.fn(),
  }));
  return {
    useAuth,
    toAppError: (e: unknown) => e,
    verifyEmail: jest.fn(() => new Promise(() => {})),
    resetPassword: jest.fn(),
    requestPasswordReset: jest.fn(),
    resendVerification: jest.fn(),
  };
});

jest.mock('@shopify/flash-list', () => require('@/components/__testutils__/flashListMock'));

jest.mock('@/features/posts', () => {
  const list = () => ({
    posts: [],
    isLoading: false,
    error: null,
    refetch: async () => {},
    isRefetching: false,
    fetchNextPage: () => {},
    hasNextPage: false,
    isFetchingNextPage: false,
  });
  const post = {
    id: 'p1',
    author: { id: '2', username: 'bob', avatar: null },
    content: 'Deep-linked post',
    image: null,
    thumbnail: null,
    likeCount: 0,
    likedByMe: false,
    bookmarked: false,
    comments: [],
    commentCount: 0,
    hashtags: [],
    mentions: [],
    isMine: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const mutation = { isPending: false, progress: null, error: null, reset: () => {} };
  return {
    useFeed: list,
    useDiscover: list,
    useTrendingPosts: list,
    useBookmarks: list,
    useUserPosts: list,
    useHashtagPosts: list,
    usePost: (id: string) => ({ post: id === 'p1' ? post : undefined, isLoading: false, error: null, refetch: async () => {} }),
    useToggleLike: () => ({ toggle: () => {} }),
    useToggleBookmark: () => ({ toggle: () => {} }),
    useDeletePost: () => ({ deletePost: async () => {}, isPending: false }),
    useCreatePost: () => ({ ...mutation, createPost: async () => post }),
    useUpdatePost: () => ({ ...mutation, updatePost: async () => post }),
    useAddComment: () => ({ addComment: async () => {}, isPending: false }),
    useDeleteComment: () => ({ deleteComment: async () => {} }),
    useToggleCommentLike: () => ({ toggle: () => {} }),
    pickImage: async () => null,
  };
});

jest.mock('@/features/users', () => {
  const list = () => ({
    users: [],
    total: 0,
    isLoading: false,
    error: null,
    refetch: async () => {},
    isRefetching: false,
    fetchNextPage: () => {},
    hasNextPage: false,
    isFetchingNextPage: false,
  });
  const profile = (id: string) =>
    id === '1' || id === '2'
      ? {
          id,
          username: id === '1' ? 'ann' : 'bob',
          avatar: null,
          bio: '',
          followersCount: 4,
          followingCount: 2,
          postsCount: 0,
          isMe: id === '1',
          isFollowing: false,
          followsYou: false,
          createdAt: '2025-01-01T00:00:00.000Z',
        }
      : undefined;
  return {
    useProfile: (id: string) => ({
      profile: profile(id),
      isLoading: false,
      error: profile(id) ? null : { status: 404, message: 'User not found', isNetworkError: false, isRateLimited: false },
      refetch: async () => {},
      isRefetching: false,
    }),
    useFollowers: list,
    useFollowing: list,
    useBlockedUsers: list,
    useToggleFollow: () => ({ toggle: () => {} }),
    useBlockUser: () => ({ block: async () => {}, unblock: async () => {}, isPending: false }),
    useUpdateProfile: () => ({ updateProfile: async () => {}, isPending: false, progress: null, error: null, reset: () => {} }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAuth } = require('@/auth') as { useAuth: { setState(s: object): void } };

// Resolved by expo-router's testing library relative to the jest rootDir (mobile/).
const APP_DIR = './src/app';
const user = { id: '1', username: 'ann', email: 'ann@example.com', emailVerified: false };

// The first test pays for lazily loading the whole route tree (slow on cold caches / Windows).
jest.setTimeout(30_000);

beforeEach(() => {
  useAuth.setState({ status: 'loading', user: null });
});

test('signed out: "/" is redirected to /login', async () => {
  const r = await renderRouter(APP_DIR, { initialUrl: '/' });
  await act(async () => useAuth.setState({ status: 'signedOut' }));
  expect(r.getPathname()).toBe('/login');
  expect(screen.getByText('Welcome back')).toBeOnTheScreen();
});

test('signed in: auth routes redirect to the Home tab (feed + New post button)', async () => {
  const r = await renderRouter(APP_DIR, { initialUrl: '/login' });
  await act(async () => useAuth.setState({ status: 'signedIn', user }));
  expect(r.getPathname()).toBe('/');
  expect(screen.getByText('Your feed is empty')).toBeOnTheScreen();
  expect(screen.getByTestId('new-post-button')).toBeOnTheScreen();
  expect(screen.getByTestId('tab-profile')).toBeOnTheScreen();
});

test('New post opens the compose modal', async () => {
  const r = await renderRouter(APP_DIR, { initialUrl: '/' });
  await act(async () => useAuth.setState({ status: 'signedIn', user }));
  await fireEvent.press(screen.getByTestId('new-post-button'));
  expect(r.getPathname()).toBe('/compose');
  expect(screen.getByTestId('compose-input')).toBeOnTheScreen();
});

test('Profile tab shows my profile + verify banner; Settings → Log out returns to /login', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const r = await renderRouter(APP_DIR, { initialUrl: '/' });
  await act(async () => useAuth.setState({ status: 'signedIn', user }));
  await fireEvent.press(screen.getByTestId('tab-profile'));
  expect(r.getPathname()).toBe('/profile');
  expect(screen.getByTestId('profile-header')).toHaveTextContent(/@ann/);
  expect(screen.getByRole('button', { name: 'Edit profile' })).toBeOnTheScreen();
  expect(screen.getByTestId('verify-banner')).toBeOnTheScreen();
  expect(screen.getByText('Your posts will show up here.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('tab', { name: 'Saved' }));
  expect(screen.getByText('No saved posts')).toBeOnTheScreen();
  expect(screen.queryByText('Log out')).toBeNull();

  await fireEvent.press(screen.getByTestId('settings-button'));
  expect(r.getPathname()).toBe('/settings');
  expect(screen.getByTestId('settings-email')).toHaveTextContent('ann@example.com');
  await fireEvent.press(screen.getByTestId('logout-button'));
  const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
  await act(async () => buttons.find((b) => b.text === 'Log out')?.onPress?.());
  expect(r.getPathname()).toBe('/login');
  alert.mockRestore();
});

test('Settings → Blocked accounts', async () => {
  const r = await renderRouter(APP_DIR, { initialUrl: '/settings' });
  await act(async () => useAuth.setState({ status: 'signedIn', user }));
  expect(r.getPathname()).toBe('/settings');
  await fireEvent.press(screen.getByTestId('blocked-link'));
  expect(r.getPathname()).toBe('/blocked');
  expect(screen.getByText('No blocked accounts')).toBeOnTheScreen();
});

test('/users/2 shows their profile, and its followers list is reachable', async () => {
  const r = await renderRouter(APP_DIR, { initialUrl: '/users/2' });
  await act(async () => useAuth.setState({ status: 'signedIn', user }));
  expect(r.getPathname()).toBe('/users/2');
  expect(screen.getByTestId('profile-header')).toHaveTextContent(/@bob/);
  expect(screen.getByRole('button', { name: 'Follow @bob' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('link', { name: '4 followers' }));
  expect(r.getPathname()).toBe('/users/2/followers');
  expect(screen.getByText('No followers yet')).toBeOnTheScreen();
});

test('/users/<own id> redirects to the Profile tab', async () => {
  const r = await renderRouter(APP_DIR, { initialUrl: '/users/1' });
  await act(async () => useAuth.setState({ status: 'signedIn', user }));
  expect(r.getPathname()).toBe('/profile');
  expect(screen.getByRole('button', { name: 'Edit profile' })).toBeOnTheScreen();
});

test('an unavailable profile (404) says so', async () => {
  await renderRouter(APP_DIR, { initialUrl: '/users/999' });
  await act(async () => useAuth.setState({ status: 'signedIn', user }));
  expect(screen.getByText("This account isn't available")).toBeOnTheScreen();
});

test('signed out: app deep links (e.g. /post/p1) redirect to /login', async () => {
  const r = await renderRouter(APP_DIR, { initialUrl: '/post/p1' });
  await act(async () => useAuth.setState({ status: 'signedOut' }));
  expect(r.getPathname()).toBe('/login');
});

test.each([
  ['/post/p1', 'Deep-linked post'],
  ['/hashtag/react', 'No posts with #react'],
  ['/users/2/following', 'Not following anyone yet'],
])('signed in: %s is reachable', async (url, text) => {
  const r = await renderRouter(APP_DIR, { initialUrl: url });
  await act(async () => useAuth.setState({ status: 'signedIn', user }));
  expect(r.getPathname()).toBe(url);
  expect(screen.getByText(text)).toBeOnTheScreen();
});

test.each(['signedOut', 'signedIn'])('verify-email deep link stays reachable when %s', async (status) => {
  const token = 'b'.repeat(64);
  const r = await renderRouter(APP_DIR, { initialUrl: `/verify-email?token=${token}` });
  await act(async () => useAuth.setState({ status, user: status === 'signedIn' ? user : null }));
  expect(r.getPathname()).toBe('/verify-email');
  expect(r.getSearchParams()).toEqual({ token });
  expect(screen.getByTestId('verify-pending')).toBeOnTheScreen();
});

test.each(['signedOut', 'signedIn'])('reset-password deep link stays reachable when %s', async (status) => {
  const r = await renderRouter(APP_DIR, { initialUrl: `/reset-password?token=${'c'.repeat(64)}` });
  await act(async () => useAuth.setState({ status, user: status === 'signedIn' ? user : null }));
  expect(r.getPathname()).toBe('/reset-password');
  expect(screen.getByText('Choose a new password')).toBeOnTheScreen();
});
