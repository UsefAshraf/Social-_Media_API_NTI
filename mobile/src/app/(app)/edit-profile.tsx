import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { toAppError, useAuth } from '@/auth';
import {
  Avatar,
  Button,
  errorMessage,
  FormError,
  HeaderButton,
  ProgressBar,
  Screen,
  TextField,
  validateUsername,
} from '@/components';
import { pickImage } from '@/features/posts';
import { useProfile, useUpdateProfile } from '@/features/users';
import type { PickedImage } from '@/lib/posts';
import { BIO_MAX_LENGTH, type Profile } from '@/lib/users';
import { useTheme } from '@/theme';

function useClose() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/profile'));
}

// Modal over the Profile tab.
export default function EditProfileScreen() {
  const myId = useAuth((s) => s.user?.id) ?? '';
  const { profile, isLoading, error, refetch } = useProfile(myId);
  const { colors, spacing, typography } = useTheme();
  const close = useClose();

  if (profile) return <EditProfileForm profile={profile} />;
  return (
    <View style={[styles.center, { padding: spacing.xl, gap: spacing.md }]}>
      <Stack.Screen options={{ headerLeft: () => <HeaderButton title="Cancel" onPress={close} /> }} />
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading profile" />
      ) : (
        <>
          <Text style={[typography.heading, { color: colors.text }]}>Couldn't load your profile</Text>
          {error ? <Text style={[typography.body, { color: colors.textMuted }]}>{errorMessage(error)}</Text> : null}
          <Button title="Try again" variant="secondary" onPress={() => refetch()} />
        </>
      )}
    </View>
  );
}

function EditProfileForm({ profile }: { profile: Profile }) {
  const { colors, spacing, typography } = useTheme();
  const close = useClose();
  const { updateProfile, isPending, progress, error: hookError, reset } = useUpdateProfile();

  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  // undefined = keep the current avatar, null = remove it, PickedImage = upload this one.
  const [avatar, setAvatar] = useState<PickedImage | null | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const trimmedName = username.trim();
  const trimmedBio = bio.trim();
  const nameChanged = trimmedName !== profile.username;
  const bioChanged = trimmedBio !== profile.bio;
  const avatarChanged = avatar !== undefined;
  const changed = nameChanged || bioChanged || avatarChanged;

  const nameError = nameChanged ? validateUsername(username) : null;
  const bioTooLong = bio.length > BIO_MAX_LENGTH;
  const canSave = changed && !isPending && !nameError && !bioTooLong;

  const previewUri = avatar ? avatar.uri : avatar === null ? null : profile.avatar;

  // Server errors that are about the username ("Username already exists") go on that field.
  const serverError = submitError ?? (hookError ? errorMessage(hookError) : null);
  const serverNameError = serverError && /username/i.test(serverError) ? serverError : null;
  const formError = serverNameError ? null : serverError;

  function clearServerError() {
    setSubmitError(null);
    reset();
  }

  async function choose(source: 'camera' | 'library') {
    setPickError(null);
    try {
      const img = await pickImage(source);
      if (img) setAvatar(img);
    } catch (e) {
      setPickError(errorMessage(toAppError(e)));
    }
  }

  async function save() {
    if (!canSave) return;
    clearServerError();
    try {
      await updateProfile({
        ...(nameChanged ? { username: trimmedName } : {}),
        ...(bioChanged ? { bio: trimmedBio } : {}),
        ...(avatarChanged ? { avatar } : {}),
      });
      close();
    } catch (e) {
      setSubmitError(errorMessage(toAppError(e)));
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit profile',
          headerLeft: () => <HeaderButton title="Cancel" onPress={close} />,
        }}
      />
      <Screen edges={['bottom', 'left', 'right']}>
        <View style={[styles.avatarBlock, { gap: spacing.md }]} testID="avatar-preview">
          <Avatar uri={previewUri} username={trimmedName || profile.username} size={96} />
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Button
              title="Camera"
              variant="secondary"
              onPress={() => choose('camera')}
              disabled={isPending}
              accessibilityLabel="Take a new profile photo"
            />
            <Button
              title="Library"
              variant="secondary"
              onPress={() => choose('library')}
              disabled={isPending}
              accessibilityLabel="Choose a profile photo from library"
            />
          </View>
          {previewUri ? (
            <Button
              title="Remove photo"
              variant="link"
              onPress={() => setAvatar(profile.avatar ? null : undefined)}
              disabled={isPending}
              testID="remove-avatar"
            />
          ) : null}
        </View>
        <FormError message={pickError} />

        <TextField
          label="Username"
          value={username}
          onChangeText={(t) => {
            setUsername(t);
            if (serverNameError) clearServerError();
          }}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
          editable={!isPending}
          error={nameError ?? serverNameError}
          testID="username-input"
        />

        <View style={{ gap: spacing.xs }}>
          <TextField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={BIO_MAX_LENGTH}
            editable={!isPending}
            placeholder="Tell people about yourself"
            textAlignVertical="top"
            testID="bio-input"
          />
          <Text
            style={[typography.caption, styles.counter, { color: bio.length >= BIO_MAX_LENGTH ? colors.danger : colors.textMuted }]}
            accessibilityLabel={`${bio.length} of ${BIO_MAX_LENGTH} characters`}
            testID="bio-counter"
          >
            {bio.length}/{BIO_MAX_LENGTH}
          </Text>
        </View>

        {progress !== null ? <ProgressBar progress={progress} /> : null}
        <FormError message={formError} />

        <Button title="Save" onPress={save} disabled={!canSave} loading={isPending} testID="save-profile" />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  avatarBlock: { alignItems: 'center' },
  counter: { alignSelf: 'flex-end' },
});
