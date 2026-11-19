import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { toAppError, useAuth } from '@/auth';
import { Avatar, Button, errorMessage, FormError, VerifyEmailBanner } from '@/components';
import { PostList } from '@/components/posts';
import { useBookmarks } from '@/features/posts';
import { useTheme } from '@/theme';

// Phase 3 turns this into a full profile (bio, followers, own posts, edit profile).
export default function ProfileScreen() {
  const bookmarks = useBookmarks();
  return (
    <PostList
      result={bookmarks}
      header={<ProfileHeader />}
      testID="saved-posts"
      emptyTitle="No saved posts"
      emptyMessage="Tap the bookmark icon on a post to save it here."
    />
  );
}

function ProfileHeader() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { colors, spacing, typography } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      // The root guard redirects to /login once status flips to signedOut.
    } catch (e) {
      setLogoutError(errorMessage(toAppError(e)));
      setLoggingOut(false);
    }
  }

  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      {user && user.emailVerified === false ? <VerifyEmailBanner email={user.email} /> : null}
      <View style={[styles.row, { gap: spacing.md }]}>
        <Avatar uri={user?.avatar ?? null} username={user?.username ?? '?'} size={64} />
        <View style={styles.flex}>
          <Text role="heading" style={[typography.heading, { color: colors.text }]}>
            @{user?.username ?? ''}
          </Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>{user?.email}</Text>
        </View>
      </View>
      <FormError message={logoutError} />
      <Button title="Log out" variant="secondary" onPress={onLogout} loading={loggingOut} />
      <Text style={[typography.heading, { color: colors.text }]}>Saved posts</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
