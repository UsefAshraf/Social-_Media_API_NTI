/// <reference types="jest" />
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeError, makeList, makePost } from '@/components/__testutils__/fixtures';
import { PostList } from '@/components/PostList';

jest.mock('@shopify/flash-list', () => require('@/components/__testutils__/flashListMock'));
jest.mock('@/features/posts', () => ({
  useToggleLike: () => ({ toggle: jest.fn() }),
  useToggleBookmark: () => ({ toggle: jest.fn() }),
  useDeletePost: () => ({ deletePost: jest.fn(), isPending: false }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/auth', () => ({ toAppError: (e: unknown) => e }));

test('first-page loading spinner', async () => {
  await render(<PostList result={makeList({ isLoading: true })} />);
  expect(screen.getByLabelText('Loading posts')).toBeOnTheScreen();
});

test('error state with retry', async () => {
  const refetch = jest.fn(async () => {});
  await render(<PostList result={makeList({ error: makeError({ message: 'Boom' }), refetch })} />);
  expect(screen.getByText('Boom')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
});

test('empty state', async () => {
  await render(<PostList result={makeList()} emptyTitle="Nothing here" />);
  expect(screen.getByText('Nothing here')).toBeOnTheScreen();
});

test('renders posts and the next-page footer spinner', async () => {
  const posts = [makePost({ id: 'a', content: 'first' }), makePost({ id: 'b', content: 'second' })];
  await render(<PostList result={makeList({ posts, hasNextPage: true, isFetchingNextPage: true })} />);
  expect(screen.getByTestId('post-a')).toBeOnTheScreen();
  expect(screen.getByTestId('post-b')).toBeOnTheScreen();
  expect(screen.getByLabelText('Loading more posts')).toBeOnTheScreen();
});

test('a failed next page keeps the posts and offers a retry', async () => {
  const fetchNextPage = jest.fn();
  await render(
    <PostList result={makeList({ posts: [makePost()], error: makeError(), hasNextPage: true, fetchNextPage })} />,
  );
  expect(screen.getByTestId('post-p1')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('link', { name: "Couldn't load more. Retry" }));
  expect(fetchNextPage).toHaveBeenCalled();
});
