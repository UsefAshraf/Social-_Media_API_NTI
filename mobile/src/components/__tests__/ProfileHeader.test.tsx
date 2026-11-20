/// <reference types="jest" />
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { makeProfile } from '@/components/__testutils__/fixtures';
import { ProfileHeader } from '@/components/ProfileHeader';

const mockToggle = jest.fn();
const mockBlock = jest.fn(async (_id: string) => {});
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('@/features/users', () => ({
  useToggleFollow: () => ({ toggle: mockToggle }),
  useBlockUser: () => ({ block: mockBlock, unblock: jest.fn(), isPending: false }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/auth', () => ({ toAppError: (e: unknown) => e }));

function pressAlertButton(spy: jest.SpyInstance, text: string) {
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
  buttons.find((b) => b.text === text)?.onPress?.();
}

beforeEach(() => jest.clearAllMocks());

test('shows username, bio, joined date and counts with accessible labels', async () => {
  await render(<ProfileHeader profile={makeProfile()} />);
  expect(screen.getByText('@bob')).toBeOnTheScreen();
  expect(screen.getByText('Hi, I am Bob')).toBeOnTheScreen();
  expect(screen.getByText('Joined March 2025')).toBeOnTheScreen();
  expect(screen.getByLabelText('7 posts')).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: '12 followers' })).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: '3 following' })).toBeOnTheScreen();
});

test('followers / following counts open the list routes', async () => {
  await render(<ProfileHeader profile={makeProfile({ id: 'u9' })} />);
  await fireEvent.press(screen.getByRole('link', { name: '12 followers' }));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/users/[id]/followers', params: { id: 'u9' } });
  await fireEvent.press(screen.getByRole('link', { name: '3 following' }));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/users/[id]/following', params: { id: 'u9' } });
});

test('own profile: Edit profile, no follow button / menu / Follows you badge', async () => {
  await render(<ProfileHeader profile={makeProfile({ isMe: true, followsYou: true })} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Edit profile' }));
  expect(mockPush).toHaveBeenCalledWith('/edit-profile');
  expect(screen.queryByTestId('follow-button')).toBeNull();
  expect(screen.queryByTestId('profile-menu')).toBeNull();
  expect(screen.queryByText('Follows you')).toBeNull();
});

test('other profile: Follow calls toggle with { id, isFollowing }', async () => {
  await render(<ProfileHeader profile={makeProfile({ id: 'u2', isFollowing: false })} />);
  expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull();
  const follow = screen.getByRole('button', { name: 'Follow @bob' });
  expect(follow).not.toBeSelected();
  await fireEvent.press(follow);
  expect(mockToggle).toHaveBeenCalledWith({ id: 'u2', isFollowing: false });
});

test('Following state is exposed and toggles off', async () => {
  await render(<ProfileHeader profile={makeProfile({ id: 'u2', isFollowing: true })} />);
  const btn = screen.getByRole('button', { name: 'Following @bob' });
  expect(btn).toBeSelected();
  expect(btn).toHaveTextContent('Following');
  await fireEvent.press(btn);
  expect(mockToggle).toHaveBeenCalledWith({ id: 'u2', isFollowing: true });
});

test('Follows you badge only when they follow the viewer', async () => {
  const r = await render(<ProfileHeader profile={makeProfile({ followsYou: false })} />);
  expect(screen.queryByText('Follows you')).toBeNull();
  await r.rerender(<ProfileHeader profile={makeProfile({ followsYou: true })} />);
  expect(screen.getByText('Follows you')).toBeOnTheScreen();
});

test('menu → Block → confirm blocks and goes back', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<ProfileHeader profile={makeProfile({ id: 'u2' })} />);
  await fireEvent.press(screen.getByRole('button', { name: 'More options for @bob' }));
  pressAlertButton(alert, 'Block');
  expect(alert).toHaveBeenLastCalledWith('Block @bob?', expect.stringContaining("won't be able to see"), expect.any(Array));
  expect(mockBlock).not.toHaveBeenCalled();
  pressAlertButton(alert, 'Block');
  expect(mockBlock).toHaveBeenCalledWith('u2');
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  // No Report option yet.
  expect((alert.mock.calls[0]?.[2] as AlertButton[]).map((b) => b.text)).toEqual(['Block', 'Cancel']);
});
