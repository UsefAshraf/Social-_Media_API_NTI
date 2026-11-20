import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

interface FollowButtonProps {
  username: string;
  isFollowing: boolean;
  onPress: () => void;
  /** Smaller variant for list rows. */
  compact?: boolean;
  disabled?: boolean;
  testID?: string;
}

/** Follow (filled) / Following (outline) toggle. */
export const FollowButton = memo(function FollowButton({
  username,
  isFollowing,
  onPress,
  compact = false,
  disabled = false,
  testID,
}: FollowButtonProps) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={isFollowing ? `Following @${username}` : `Follow @${username}`}
      accessibilityHint={isFollowing ? 'Double tap to unfollow' : undefined}
      accessibilityState={{ selected: isFollowing, disabled }}
      hitSlop={compact ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: radius.pill,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          minHeight: compact ? 32 : 40,
          backgroundColor: isFollowing ? 'transparent' : colors.primary,
          borderColor: isFollowing ? colors.border : colors.primary,
          opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[typography.label, { color: isFollowing ? colors.text : colors.onPrimary }]}>
        {isFollowing ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
