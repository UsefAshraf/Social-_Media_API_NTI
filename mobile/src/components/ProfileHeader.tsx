import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/auth';
import { useBlockUser, useToggleFollow } from '@/features/users';
import type { Profile } from '@/lib/users';
import { useTheme } from '@/theme';

import { Avatar } from './Avatar';
import { Button } from './Button';
import { FollowButton } from './FollowButton';
import { errorMessage } from './forms';

interface ProfileHeaderProps {
  profile: Profile;
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export function formatJoined(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Avatar, name, bio, counts and the follow / edit / block actions for a profile. */
export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const router = useRouter();
  const { toggle } = useToggleFollow();
  const { block, isPending: blocking } = useBlockUser();
  const joined = formatJoined(profile.createdAt);

  function openList(kind: 'followers' | 'following') {
    router.push({ pathname: `/users/[id]/${kind}`, params: { id: profile.id } });
  }

  function confirmBlock() {
    Alert.alert(
      `Block @${profile.username}?`,
      "They won't be able to see your profile or posts, and you won't see theirs. They won't be told. You can unblock them any time from Settings → Blocked accounts.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            block(profile.id)
              .then(() => (router.canGoBack() ? router.back() : router.replace('/')))
              .catch((e: unknown) => Alert.alert("Couldn't block", errorMessage(toAppError(e))));
          },
        },
      ],
    );
  }

  function openMenu() {
    Alert.alert(`@${profile.username}`, undefined, [
      { text: 'Block', style: 'destructive', onPress: confirmBlock },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }} testID="profile-header">
      <View style={[styles.row, { gap: spacing.lg }]}>
        <Avatar uri={profile.avatar} username={profile.username} size={80} />
        <View style={[styles.flex, { gap: spacing.xs }]}>
          <Text role="heading" style={[typography.heading, { color: colors.text }]} numberOfLines={1}>
            @{profile.username}
          </Text>
          {profile.followsYou && !profile.isMe ? (
            <View
              style={[styles.badge, { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.sm }]}
              testID="follows-you"
            >
              <Text style={[typography.caption, { color: colors.textMuted }]}>Follows you</Text>
            </View>
          ) : null}
          {joined ? (
            <View style={[styles.row, { gap: spacing.xs }]}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text style={[typography.caption, { color: colors.textMuted }]}>Joined {joined}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {profile.bio ? (
        <Text style={[typography.body, { color: colors.text }]} testID="profile-bio">
          {profile.bio}
        </Text>
      ) : null}

      <View style={[styles.row, { gap: spacing.xl }]}>
        <Count value={profile.postsCount} label={profile.postsCount === 1 ? 'Post' : 'Posts'} a11y={plural(profile.postsCount, 'post')} />
        <Count
          value={profile.followersCount}
          label={profile.followersCount === 1 ? 'Follower' : 'Followers'}
          a11y={plural(profile.followersCount, 'follower')}
          onPress={() => openList('followers')}
          testID="followers-link"
        />
        <Count
          value={profile.followingCount}
          label="Following"
          a11y={`${profile.followingCount} following`}
          onPress={() => openList('following')}
          testID="following-link"
        />
      </View>

      {profile.isMe ? (
        <Button
          title="Edit profile"
          variant="secondary"
          onPress={() => router.push('/edit-profile')}
          testID="edit-profile-button"
        />
      ) : (
        <View style={[styles.row, { gap: spacing.sm }]}>
          <View style={styles.flex}>
            <FollowButton
              username={profile.username}
              isFollowing={profile.isFollowing}
              onPress={() => toggle({ id: profile.id, isFollowing: profile.isFollowing })}
              testID="follow-button"
            />
          </View>
          <Pressable
            onPress={openMenu}
            disabled={blocking}
            accessibilityRole="button"
            accessibilityLabel={`More options for @${profile.username}`}
            hitSlop={8}
            testID="profile-menu"
            style={({ pressed }) => [
              styles.menu,
              { borderColor: colors.border, borderRadius: radius.pill, opacity: pressed || blocking ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

interface CountProps {
  value: number;
  label: string;
  a11y: string;
  onPress?: () => void;
  testID?: string;
}

function Count({ value, label, a11y, onPress, testID }: CountProps) {
  const { colors, spacing, typography } = useTheme();
  const content = (
    <>
      <Text style={[typography.label, { color: colors.text }]}>{value}</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
    </>
  );
  if (!onPress) {
    return (
      <View style={[styles.row, { gap: spacing.xs }]} accessible accessibilityLabel={a11y} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={a11y}
      hitSlop={8}
      testID={testID}
      style={({ pressed }) => [styles.row, { gap: spacing.xs, opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  badge: { alignSelf: 'flex-start', paddingVertical: 2 },
  menu: { width: 40, height: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
