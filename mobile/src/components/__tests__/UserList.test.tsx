/// <reference types="jest" />
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import BlockedScreen from '@/app/(app)/blocked';
import { makeError, makeUser, makeUserList } from '@/components/__testutils__/fixtures';
import { UserList } from '@/components/UserList';
import type { UserListResult } from '@/lib/users';

const mockToggle = jest.fn();
const mockUnblock = jest.fn(async (_id: string) => {});
const mockPush = jest.fn();
let mockBlocked: UserListResult = makeUserList();

jest.mock('@shopify/flash-list', () => require('@/components/__testutils__/flashListMock'));
jest.mock('@/features/users', () => ({
  useToggleFollow: () => ({ toggle: mockToggle }),
  useBlockUser: () => ({ block: jest.fn(), unblock: mockUnblock, isPending: false }),
  useBlockedUsers: () => mockBlocked,
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/auth', () => ({ toAppError: (e: unknown) => e }));

beforeEach(() => {
  jest.clearAllMocks();
  mockBlocked = makeUserList();
});

const users = [
  makeUser({ id: 'a', username: 'alice', bio: 'Line one', isFollowing: true }),
  makeUser({ id: 'b', username: 'bob' }),
  makeUser({ id: 'me', username: 'ann', isMe: true }),
];

test('rows show username, bio and Follow (not for yourself); tap opens the profile', async () => {
  await render(<UserList result={makeUserList({ users })} />);
  expect(screen.getByText('Line one')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Following @alice' })).toBeSelected();
  expect(screen.queryByTestId('follow-me')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Follow @bob' }));
  expect(mockToggle).toHaveBeenCalledWith({ id: 'b', isFollowing: false });

  await fireEvent.press(screen.getByRole('link', { name: '@alice, Line one' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/users/[id]', params: { id: 'a' } });
});

test('loading, empty and error/retry states', async () => {
  const r = await render(<UserList result={makeUserList({ isLoading: true })} />);
  expect(screen.getByLabelText('Loading people')).toBeOnTheScreen();

  await r.rerender(<UserList result={makeUserList()} emptyTitle="No followers yet" />);
  expect(screen.getByText('No followers yet')).toBeOnTheScreen();

  const refetch = jest.fn(async () => {});
  await r.rerender(<UserList result={makeUserList({ error: makeError({ message: 'Boom' }), refetch })} />);
  expect(screen.getByText('Boom')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
});

test('next-page spinner, and a failed next page offers retry', async () => {
  const r = await render(<UserList result={makeUserList({ users, hasNextPage: true, isFetchingNextPage: true })} />);
  expect(screen.getByLabelText('Loading more people')).toBeOnTheScreen();
  const fetchNextPage = jest.fn();
  await r.rerender(<UserList result={makeUserList({ users, hasNextPage: true, error: makeError(), fetchNextPage })} />);
  await fireEvent.press(screen.getByRole('link', { name: "Couldn't load more. Retry" }));
  expect(fetchNextPage).toHaveBeenCalled();
});

describe('Blocked accounts screen', () => {
  test('rows show Unblock instead of Follow; confirming calls unblock', async () => {
    mockBlocked = makeUserList({ users: [makeUser({ id: 'x', username: 'troll' })] });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<BlockedScreen />);
    expect(screen.queryByRole('button', { name: 'Follow @troll' })).toBeNull();
    expect(screen.queryByRole('link', { name: '@troll' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Unblock @troll' }));
    expect(alert).toHaveBeenCalledWith('Unblock @troll?', expect.any(String), expect.any(Array));
    expect(mockUnblock).not.toHaveBeenCalled();
    const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
    buttons.find((b) => b.text === 'Unblock')?.onPress?.();
    expect(mockUnblock).toHaveBeenCalledWith('x');
  });

  test('cancelling does not unblock; empty state', async () => {
    mockBlocked = makeUserList({ users: [makeUser({ id: 'x', username: 'troll' })] });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await render(<BlockedScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Unblock @troll' }));
    (alert.mock.calls.at(-1)?.[2] as AlertButton[]).find((b) => b.text === 'Cancel')?.onPress?.();
    expect(mockUnblock).not.toHaveBeenCalled();

    mockBlocked = makeUserList();
    await r.rerender(<BlockedScreen />);
    expect(screen.getByText('No blocked accounts')).toBeOnTheScreen();
  });
});
