/// <reference types="jest" />
import { fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert, type AlertButton } from 'react-native';

import PostDetailScreen from '@/app/(app)/post/[id]';
import { makeComment, makeError, makePost } from '@/components/__testutils__/fixtures';
import { threadComments } from '@/components/CommentItem';
import type { AppError } from '@/lib/contracts';
import type { Post } from '@/lib/posts';

const mockAddComment = jest.fn(async (_input: { content: string; parentId?: string }) => {});
const mockDeleteComment = jest.fn(async (_id: string) => {});
const mockToggleCommentLike = jest.fn();
const mockBack = jest.fn();
const mockDeletePost = jest.fn(async (_id: string) => {});
let mockPostState: { post: Post | undefined; isLoading: boolean; error: AppError | null };

jest.mock('@shopify/flash-list', () => require('@/components/__testutils__/flashListMock'));
jest.mock('expo-router/react-navigation', () => ({
  HeaderHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'p1' }),
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn(), push: jest.fn() }),
}));
jest.mock('@/auth', () => {
  const state = { user: { id: 'me', username: 'me' } };
  return {
    useAuth: (sel: (s: typeof state) => unknown) => sel(state),
    toAppError: (e: unknown) => e,
  };
});
jest.mock('@/features/posts', () => ({
  usePost: () => ({ ...mockPostState, refetch: async () => {} }),
  useAddComment: () => ({ addComment: mockAddComment, isPending: false }),
  useDeleteComment: () => ({ deleteComment: mockDeleteComment }),
  useToggleCommentLike: () => ({ toggle: mockToggleCommentLike }),
  useToggleLike: () => ({ toggle: jest.fn() }),
  useToggleBookmark: () => ({ toggle: jest.fn() }),
  useDeletePost: () => ({ deletePost: mockDeletePost, isPending: false }),
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const render = (ui: ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

const me = { id: 'me', username: 'me', avatar: null };
const bob = { id: 'u2', username: 'bob', avatar: null };
const comments = [
  makeComment({ id: 'c1', author: bob }),
  makeComment({ id: 'c2', author: me }),
  makeComment({ id: 'r2', author: bob, parentId: 'c2' }),
  makeComment({ id: 'r1', author: me, parentId: 'c1' }),
];

beforeEach(() => {
  jest.clearAllMocks();
  mockPostState = {
    post: makePost({ content: 'The post body', comments, commentCount: comments.length }),
    isLoading: false,
    error: null,
  };
});

test('threadComments: replies follow their parent; orphans become top-level', () => {
  const rows = threadComments([...comments, makeComment({ id: 'o1', parentId: 'gone' })]);
  expect(rows.map((r) => [r.comment.id, r.depth])).toEqual([
    ['c1', 0],
    ['r1', 1],
    ['c2', 0],
    ['r2', 1],
    ['o1', 0],
  ]);
});

test('renders the post and comments threaded one level, replies under their parent', async () => {
  await render(<PostDetailScreen />);
  expect(screen.getByText('The post body')).toBeOnTheScreen();
  const ids = screen.getAllByTestId(/^comment-(c|r)\d$/).map((n) => n.props.testID);
  expect(ids).toEqual(['comment-c1', 'comment-r1', 'comment-c2', 'comment-r2']);
  expect(screen.getByTestId('comment-r1')).toHaveAccessibleName('Reply by me');
  expect(screen.getByTestId('comment-c1')).toHaveAccessibleName('Comment by bob');
});

test('Reply sets parentId and shows "Replying to @x"; cancel clears it', async () => {
  await render(<PostDetailScreen />);
  await fireEvent.press(screen.getByTestId('comment-reply-c1'));
  expect(screen.getByTestId('replying-to')).toHaveTextContent(/Replying to @bob/);

  await fireEvent.changeText(screen.getByTestId('comment-input'), ' nice ');
  await fireEvent.press(screen.getByTestId('comment-send'));
  expect(mockAddComment).toHaveBeenCalledWith({ content: 'nice', parentId: 'c1' });
  await waitFor(() => expect(screen.queryByTestId('replying-to')).toBeNull());

  // Replying to a reply attaches to the top-level parent (threads are one level deep).
  await fireEvent.press(screen.getByTestId('comment-reply-r2'));
  expect(screen.getByTestId('replying-to')).toHaveTextContent(/Replying to @bob/);
  await fireEvent.changeText(screen.getByTestId('comment-input'), 'x');
  await fireEvent.press(screen.getByTestId('comment-send'));
  expect(mockAddComment).toHaveBeenLastCalledWith({ content: 'x', parentId: 'c2' });

  await fireEvent.press(screen.getByTestId('comment-reply-c1'));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel reply' }));
  expect(screen.queryByTestId('replying-to')).toBeNull();
});

test('top-level comment has no parentId', async () => {
  await render(<PostDetailScreen />);
  await fireEvent.changeText(screen.getByTestId('comment-input'), 'hello');
  await fireEvent.press(screen.getByTestId('comment-send'));
  expect(mockAddComment).toHaveBeenCalledWith({ content: 'hello' });
});

test('comment composer: 500-char counter, send disabled when empty or too long', async () => {
  await render(<PostDetailScreen />);
  expect(screen.getByTestId('comment-counter')).toHaveTextContent('0/500');
  expect(screen.getByTestId('comment-send')).toBeDisabled();
  await fireEvent.changeText(screen.getByTestId('comment-input'), 'a'.repeat(501));
  expect(screen.getByTestId('comment-counter')).toHaveTextContent('501/500');
  expect(screen.getByTestId('comment-send')).toBeDisabled();
});

test('likes a comment; only own comments can be deleted (after confirming)', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<PostDetailScreen />);
  await fireEvent.press(screen.getByTestId('comment-like-c1'));
  expect(mockToggleCommentLike).toHaveBeenCalledWith('c1');

  expect(within(screen.getByTestId('comment-c1')).queryByRole('button', { name: 'Delete comment' })).toBeNull();
  await fireEvent.press(screen.getByTestId('comment-delete-c2'));
  expect(mockDeleteComment).not.toHaveBeenCalled();
  const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
  buttons.find((b) => b.text === 'Delete')?.onPress?.();
  expect(mockDeleteComment).toHaveBeenCalledWith('c2');
});

test.each([404, 403])('%s → "Post not available"', async (status) => {
  mockPostState = { post: undefined, isLoading: false, error: makeError({ status, message: 'nope' }) };
  await render(<PostDetailScreen />);
  expect(screen.getByText('Post not available')).toBeOnTheScreen();
});

test('other errors offer a retry', async () => {
  mockPostState = { post: undefined, isLoading: false, error: makeError({ status: null, isNetworkError: true }) };
  await render(<PostDetailScreen />);
  expect(screen.getByText("Couldn't load post")).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
});

test('deleting the post from the detail screen goes back', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockPostState = { post: makePost({ isMine: true }), isLoading: false, error: null };
  await render(<PostDetailScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Post options' }));
  (alert.mock.calls.at(-1)?.[2] as AlertButton[]).find((b) => b.text === 'Delete')?.onPress?.();
  (alert.mock.calls.at(-1)?.[2] as AlertButton[]).find((b) => b.text === 'Delete')?.onPress?.();
  expect(mockDeletePost).toHaveBeenCalledWith('p1');
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
});
