/// <reference types="jest" />
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import EditProfileScreen from '@/app/(app)/edit-profile';
import { makeError, makeProfile } from '@/components/__testutils__/fixtures';
import type { AppError } from '@/lib/contracts';
import type { PickedImage } from '@/lib/posts';
import type { Profile } from '@/lib/users';

const mockUpdateProfile = jest.fn();
const mockPickImage = jest.fn();
const mockBack = jest.fn();
let mockProfile: Profile | undefined;
let mockMutation: { isPending: boolean; progress: number | null; error: AppError | null } = {
  isPending: false,
  progress: null,
  error: null,
};

jest.mock('@/features/users', () => ({
  useProfile: () => ({ profile: mockProfile, isLoading: false, error: null, refetch: async () => {}, isRefetching: false }),
  useUpdateProfile: () => ({ ...mockMutation, updateProfile: mockUpdateProfile, reset: () => {} }),
}));
jest.mock('@/features/posts', () => ({ pickImage: (source: string) => mockPickImage(source) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn(), push: jest.fn() }),
  Stack: { Screen: () => null },
}));
jest.mock('@/auth', () => ({
  toAppError: (e: unknown) => e,
  useAuth: (sel: (s: object) => unknown) => sel({ user: { id: 'me' } }),
  resendVerification: jest.fn(),
}));

const image: PickedImage = { uri: 'file:///me.jpg', width: 400, height: 400, mimeType: 'image/jpeg', fileSize: 1000 };

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = makeProfile({ id: 'me', username: 'ann', bio: 'Old bio', avatar: 'https://cdn/a.jpg', isMe: true });
  mockMutation = { isPending: false, progress: null, error: null };
  mockUpdateProfile.mockResolvedValue(mockProfile);
});

test('Save is disabled until something changes', async () => {
  await render(<EditProfileScreen />);
  expect(screen.getByLabelText('Username')).toHaveDisplayValue('ann');
  expect(screen.getByTestId('save-profile')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Bio'), 'New bio');
  expect(screen.getByTestId('save-profile')).toBeEnabled();
  await fireEvent.changeText(screen.getByLabelText('Bio'), 'Old bio');
  expect(screen.getByTestId('save-profile')).toBeDisabled();
});

test('sends only the changed fields, then closes', async () => {
  await render(<EditProfileScreen />);
  await fireEvent.changeText(screen.getByLabelText('Bio'), '  New bio ');
  expect(screen.getByTestId('bio-counter')).toHaveTextContent('10/160');
  await fireEvent.press(screen.getByTestId('save-profile'));
  expect(mockUpdateProfile).toHaveBeenCalledWith({ bio: 'New bio' });
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
});

test('invalid username shows the register validation and blocks Save', async () => {
  await render(<EditProfileScreen />);
  await fireEvent.changeText(screen.getByLabelText('Username'), 'a b');
  expect(screen.getByText('Only letters, numbers and underscores')).toBeOnTheScreen();
  expect(screen.getByTestId('save-profile')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Username'), 'ann_2');
  await fireEvent.press(screen.getByTestId('save-profile'));
  expect(mockUpdateProfile).toHaveBeenCalledWith({ username: 'ann_2' });
});

test('removing the avatar sends avatar: null', async () => {
  await render(<EditProfileScreen />);
  await fireEvent.press(screen.getByTestId('remove-avatar'));
  expect(screen.queryByTestId('remove-avatar')).toBeNull();
  await fireEvent.press(screen.getByTestId('save-profile'));
  expect(mockUpdateProfile).toHaveBeenCalledWith({ avatar: null });
});

test('a picked avatar is sent as the PickedImage', async () => {
  mockPickImage.mockResolvedValue(image);
  await render(<EditProfileScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Choose a profile photo from library' }));
  expect(mockPickImage).toHaveBeenCalledWith('library');
  await waitFor(() => expect(screen.getByTestId('save-profile')).toBeEnabled());
  await fireEvent.press(screen.getByTestId('save-profile'));
  expect(mockUpdateProfile).toHaveBeenCalledWith({ avatar: image });
});

test('server "Username already exists" is shown on the username field and stays open', async () => {
  mockUpdateProfile.mockRejectedValue(makeError({ status: 400, message: 'Username already exists' }));
  await render(<EditProfileScreen />);
  await fireEvent.changeText(screen.getByLabelText('Username'), 'taken');
  await fireEvent.press(screen.getByTestId('save-profile'));
  expect(await screen.findByText('Username already exists')).toBeOnTheScreen();
  expect(screen.getByLabelText('Username')).toHaveProp('accessibilityHint', 'Username already exists');
  expect(screen.queryByTestId('form-error')).toBeNull();
  expect(mockBack).not.toHaveBeenCalled();
});

test('other server errors go in the form error banner', async () => {
  mockUpdateProfile.mockRejectedValue(makeError({ message: 'Upload failed' }));
  await render(<EditProfileScreen />);
  await fireEvent.changeText(screen.getByLabelText('Bio'), 'x');
  await fireEvent.press(screen.getByTestId('save-profile'));
  expect(await screen.findByTestId('form-error')).toHaveTextContent('Upload failed');
});

test('upload progress shows while pending, and Save is disabled', async () => {
  mockMutation = { isPending: true, progress: 0.5, error: null };
  await render(<EditProfileScreen />);
  expect(screen.getByTestId('upload-progress')).toHaveTextContent('Uploading 50%');
  expect(screen.getByTestId('save-profile')).toBeDisabled();
});
