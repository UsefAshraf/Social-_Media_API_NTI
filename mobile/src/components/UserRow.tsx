import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { UserSummary } from '@/lib/users';
import { useTheme } from '@/theme';

import { Avatar } from './Avatar';
import { FollowButton } from './FollowButton';

export interface UserRowProps {
  user: UserSummary;
  /** Tap on the row. Omitted → the row isn't tappable (e.g. blocked accounts). */
  onOpen?: (user: UserSummary) => void;
  /** Shows a Follow / Following button (never for yourself). */
  onToggleFollow?: (user: UserSummary) => void;
  /** Shows an Unblock button instead of Follow. */
  onUnblock?: (user: UserSummary) => void;
}

/** Avatar, username, one line of bio and an action. Handlers must be stable (the row is memoised). */
export const UserRow = memo(function UserRow({ user, onOpen, onToggleFollow, onUnblock }: UserRowProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const action = onUnblock ? (
    <Pressable
      onPress={() => onUnblock(user)}
      accessibilityRole="button"
      accessibilityLabel={`Unblock @${user.username}`}
      hitSlop={6}
      testID={`unblock-${user.id}`}
      style={({ pressed }) => [
        styles.unblock,
        { borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[typography.label, { color: colors.text }]}>Unblock</Text>
    </Pressable>
  ) : onToggleFollow && !user.isMe ? (
    <FollowButton
      compact
      username={user.username}
      isFollowing={user.isFollowing}
      onPress={() => onToggleFollow(user)}
      testID={`follow-${user.id}`}
    />
  ) : null;

  const body = (
    <>
      <Avatar uri={user.avatar} username={user.username} size={44} />
      <View style={styles.flex}>
        <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
          @{user.username}
          {user.isMe ? <Text style={{ color: colors.textMuted }}> · You</Text> : null}
        </Text>
        {user.bio ? (
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {user.bio}
          </Text>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={[styles.row, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md }]} testID={`user-${user.id}`}>
      {onOpen ? (
        <Pressable
          onPress={() => onOpen(user)}
          accessibilityRole="link"
          accessibilityLabel={`@${user.username}${user.bio ? `, ${user.bio}` : ''}`}
          style={({ pressed }) => [styles.row, styles.flex, { gap: spacing.md, opacity: pressed ? 0.7 : 1 }]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={[styles.row, styles.flex, { gap: spacing.md }]}>{body}</View>
      )}
      {action}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  unblock: { borderWidth: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
});
