/// <reference types="jest" />
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ComposeScreen from '@/app/(app)/compose';
import { makeError, makePost } from '@/components/__testutils__/fixtures';
import type { AppError } from '@/lib/contracts';
import type { PickedImage, Post } from '@/lib/posts';

const mockCreatePost = jest.fn();
const mockUpdatePost = jest.fn();
const mockPickImage = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
let mockMutation: { isPending: boolean; progress: number | null; error: AppError | null } = {
  isPending: false,
  progress: null,
  error: null,
};
let mockPostState: { post: Post | undefined; isLoading: boolean; error: AppError | null } = {
  post: undefined,
  isLoading: false,
  error: null,
};

jest.mock('@/features/posts', () => ({
  useCreatePost: () => ({ ...mockMutation, createPost: mockCreatePost, reset: () => {} }),
  useUpdatePost: () => ({ ...mockMutation, updatePost: mockUpdatePost, reset: () => {} }),
  usePost: () => ({ ...mockPostState, refetch: async () => {} }),
  pickImage: (source: string) => mockPickImage(source),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn(), push: jest.fn() }),
  Stack: { Screen: () => null },
}));
jest.mock('@/auth', () => ({ toAppError: (e: unknown) => e }));

const image: PickedImage = { uri: 'file:///photo.jpg', width: 800, height: 600, mimeType: 'image/jpeg', fileSize: 1000 };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockMutation = { isPending: false, progress: null, error: null };
  mockPostState = { post: undefined, isLoading: false, error: null };
  mockCreatePost.mockResolvedValue(makePost());
  mockUpdatePost.mockResolvedValue(makePost());
});

test('submit is disabled while the post is empty (or whitespace)', async () => {
  await render(<ComposeScreen />);
  expect(screen.getByTestId('compose-submit')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Post content'), '   ');
  expect(screen.getByTestId('compose-submit')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Post content'), 'hi');
  expect(screen.getByTestId('compose-submit')).toBeEnabled();
  expect(screen.getByTestId('compose-counter')).toHaveTextContent('2/1000');
});

test('creates a post with content + picked image, then closes', async () => {
  mockPickImage.mockResolvedValue(image);
  await render(<ComposeScreen />);
  await fireEvent.changeText(screen.getByLabelText('Post content'), '  Hello #world  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }));
  expect(mockPickImage).toHaveBeenCalledWith('library');
  await waitFor(() => expect(screen.getByTestId('image-preview')).toBeOnTheScreen());

  await fireEvent.press(screen.getByTestId('compose-submit'));
  expect(mockCreatePost).toHaveBeenCalledWith({ content: 'Hello #world', image });
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
});

test('removing the picked image posts without one', async () => {
  mockPickImage.mockResolvedValue(image);
  await render(<ComposeScreen />);
  await fireEvent.changeText(screen.getByLabelText('Post content'), 'x');
  await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));
  expect(mockPickImage).toHaveBeenCalledWith('camera');
  await fireEvent.press(await screen.findByRole('button', { name: 'Remove image' }));
  expect(screen.queryByTestId('image-preview')).toBeNull();
  await fireEvent.press(screen.getByTestId('compose-submit'));
  expect(mockCreatePost).toHaveBeenCalledWith({ content: 'x' });
});

test('shows upload progress while uploading', async () => {
  mockMutation = { isPending: true, progress: 0.42, error: null };
  await render(<ComposeScreen />);
  expect(screen.getByTestId('upload-progress')).toHaveTextContent('Uploading 42%');
  expect(screen.getByTestId('compose-submit')).toBeDisabled();
});

test('no progress bar when progress is null', async () => {
  await render(<ComposeScreen />);
  expect(screen.queryByTestId('upload-progress')).toBeNull();
});

test('shows the server error (e.g. 403 verify your email) and stays open', async () => {
  const err = makeError({ status: 403, message: 'Please verify your email before posting' });
  mockCreatePost.mockRejectedValue(err);
  await render(<ComposeScreen />);
  await fireEvent.changeText(screen.getByLabelText('Post content'), 'hi');
  await fireEvent.press(screen.getByTestId('compose-submit'));
  expect(await screen.findByTestId('form-error')).toHaveTextContent('Please verify your email before posting');
  expect(mockBack).not.toHaveBeenCalled();
});

test('shows the hook error state', async () => {
  mockMutation = { isPending: false, progress: null, error: makeError({ message: 'Upload failed' }) };
  await render(<ComposeScreen />);
  expect(screen.getByTestId('form-error')).toHaveTextContent('Upload failed');
});

describe('edit mode (?postId=)', () => {
  const existing = makePost({ id: 'p9', content: 'Old text', image: 'https://cdn/x.jpg', isMine: true });

  test('prefills, and removing the image sends image: null', async () => {
    mockParams = { postId: 'p9' };
    mockPostState = { post: existing, isLoading: false, error: null };
    await render(<ComposeScreen />);
    expect(screen.getByLabelText('Post content')).toHaveDisplayValue('Old text');
    expect(screen.getByTestId('image-preview')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Post content'), 'New text');
    await fireEvent.press(screen.getByRole('button', { name: 'Remove image' }));
    await fireEvent.press(screen.getByTestId('compose-submit'));
    expect(mockUpdatePost).toHaveBeenCalledWith({ postId: 'p9', content: 'New text', image: null });
    expect(mockCreatePost).not.toHaveBeenCalled();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  test('keeping the image omits it; replacing sends the new one', async () => {
    mockParams = { postId: 'p9' };
    mockPostState = { post: existing, isLoading: false, error: null };
    await render(<ComposeScreen />);
    await fireEvent.press(screen.getByTestId('compose-submit'));
    expect(mockUpdatePost).toHaveBeenLastCalledWith({ postId: 'p9', content: 'Old text' });

    mockPickImage.mockResolvedValue(image);
    await fireEvent.press(screen.getByRole('button', { name: 'Replace image from library' }));
    await waitFor(() => expect(mockPickImage).toHaveBeenCalled());
    await fireEvent.press(screen.getByTestId('compose-submit'));
    expect(mockUpdatePost).toHaveBeenLastCalledWith({ postId: 'p9', content: 'Old text', image });
  });

  test('loading, then "Post not available" on 404', async () => {
    mockParams = { postId: 'nope' };
    mockPostState = { post: undefined, isLoading: true, error: null };
    const r = await render(<ComposeScreen />);
    expect(screen.getByLabelText('Loading post')).toBeOnTheScreen();
    mockPostState = { post: undefined, isLoading: false, error: makeError({ status: 404, message: 'Post not found' }) };
    await r.rerender(<ComposeScreen />);
    expect(screen.getByText('Post not available')).toBeOnTheScreen();
  });
});
