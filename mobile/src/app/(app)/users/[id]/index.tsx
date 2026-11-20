import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth';
import { Button, errorMessage, firstParam } from '@/components';
import { PostList } from '@/components/posts';
import { ProfileHeader } from '@/components/users';
import { useUserPosts } from '@/features/posts';
import { useProfile } from '@/features/users';
import { useTheme } from '@/theme';

export default function UserScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id) ?? '';
  const myId = useAuth((s) => s.user?.id);
  // Your own profile lives in the Profile tab.
  if (myId && id === myId) return <Redirect href="/profile" />;
  return <UserProfile key={id} userId={id} />;
}

function UserProfile({ userId }: { userId: string }) {
  const { profile, isLoading, error, refetch } = useProfile(userId);
  const posts = useUserPosts(userId);
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();

  // Pull-to-refresh on the list refreshes the profile (counts, follow state) too.
  const result = useMemo(
    () => ({ ...posts, refetch: () => Promise.all([posts.refetch(), refetch()]) }),
    [posts, refetch],
  );

  const title = profile ? `@${profile.username}` : 'Profile';

  if (!profile) {
    if (isLoading) {
      return (
        <View style={styles.center} testID="profile-loading">
          <Stack.Screen options={{ title }} />
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading profile" />
        </View>
      );
    }
    const unavailable = !error || error.status === 404;
    return (
      <View style={[styles.center, { padding: spacing.xl, gap: spacing.md }]} testID="profile-unavailable">
        <Stack.Screen options={{ title }} />
        <Text style={[typography.heading, styles.centerText, { color: colors.text }]}>
          {unavailable ? "This account isn't available" : "Couldn't load profile"}
        </Text>
        <Text style={[typography.body, styles.centerText, { color: colors.textMuted }]}>
          {unavailable ? 'It may have been deleted, or you can’t view it.' : errorMessage(error)}
        </Text>
        {unavailable ? (
          <Button title="Go back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        ) : (
          <Button title="Try again" variant="secondary" onPress={() => refetch()} />
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <PostList
        result={result}
        testID="user-posts"
        emptyTitle="No posts yet"
        header={<ProfileHeader profile={profile} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
});
