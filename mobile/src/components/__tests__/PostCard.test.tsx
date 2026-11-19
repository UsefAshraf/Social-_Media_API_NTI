/// <reference types="jest" />
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { makePost } from '@/components/__testutils__/fixtures';
import { arePostCardPropsEqual, PostCard } from '@/components/PostCard';
import { usePostActions } from '@/components/usePostActions';
import type { Post } from '@/lib/posts';

const mockToggleLike = jest.fn();
const mockToggleBookmark = jest.fn();
const mockDeletePost = jest.fn(async (_id: string) => {});
const mockPush = jest.fn();

jest.mock('@/features/posts', () => ({
  useToggleLike: () => ({ toggle: mockToggleLike }),
  useToggleBookmark: () => ({ toggle: mockToggleBookmark }),
  useDeletePost: () => ({ deletePost: mockDeletePost, isPending: false }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/auth', () => ({ toAppError: (e: unknown) => e }));

function Harness({ post }: { post: Post }) {
  const actions = usePostActions();
  return <PostCard post={post} actions={actions} />;
}

/** Presses the button with this text in the most recent Alert.alert call. */
function pressAlertButton(spy: jest.SpyInstance, text: string) {
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
  const b = buttons.find((x) => x.text === text);
  if (!b?.onPress) throw new Error(`No "${text}" button`);
  b.onPress();
}

beforeEach(() => jest.clearAllMocks());

test('like button calls toggle(post) and is labelled with the count', async () => {
  const post = makePost({ likeCount: 3 });
  await render(<Harness post={post} />);
  const like = screen.getByRole('button', { name: 'Like, 3 likes' });
  expect(like).not.toBeSelected();
  await fireEvent.press(like);
  expect(mockToggleLike).toHaveBeenCalledWith(post);
});

test('liked post shows as selected; singular label', async () => {
  await render(<Harness post={makePost({ likeCount: 1, likedByMe: true })} />);
  expect(screen.getByRole('button', { name: 'Like, 1 like' })).toBeSelected();
});

test('bookmark toggles and comment count is labelled', async () => {
  const post = makePost({ commentCount: 2 });
  await render(<Harness post={post} />);
  expect(screen.getByRole('button', { name: 'Comments, 2 comments' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Bookmark' }));
  expect(mockToggleBookmark).toHaveBeenCalledWith(post);
});

test('username opens the author profile; comments open the detail', async () => {
  await render(<Harness post={makePost({ commentCount: 1 })} />);
  await fireEvent.press(screen.getByRole('link', { name: '@bob' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/users/[id]', params: { id: 'u2' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Comments, 1 comment' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/post/[id]', params: { id: 'p1' } });
});

test('no options menu on other people’s posts', async () => {
  await render(<Harness post={makePost({ isMine: false })} />);
  expect(screen.queryByRole('button', { name: 'Post options' })).toBeNull();
});

test('own post: menu → Edit opens compose in edit mode', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<Harness post={makePost({ isMine: true })} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Post options' }));
  pressAlertButton(alert, 'Edit');
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/compose', params: { postId: 'p1' } });
});

test('own post: menu → Delete asks for confirmation, then deletes', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<Harness post={makePost({ isMine: true })} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Post options' }));
  pressAlertButton(alert, 'Delete');
  expect(mockDeletePost).not.toHaveBeenCalled();
  expect(alert).toHaveBeenLastCalledWith('Delete post?', expect.any(String), expect.any(Array));
  pressAlertButton(alert, 'Delete');
  expect(mockDeletePost).toHaveBeenCalledWith('p1');
});

test('memo comparator: re-render only when displayed fields change', () => {
  const actions = {} as never;
  const a = makePost();
  const same = { ...a, author: { ...a.author } };
  expect(arePostCardPropsEqual({ post: a, actions }, { post: same, actions })).toBe(true);
  for (const change of [
    { likeCount: 4 },
    { likedByMe: true },
    { bookmarked: true },
    { commentCount: 1 },
    { updatedAt: new Date().toISOString() },
    { id: 'p2' },
  ]) {
    expect(arePostCardPropsEqual({ post: a, actions }, { post: { ...a, ...change }, actions })).toBe(false);
  }
});
