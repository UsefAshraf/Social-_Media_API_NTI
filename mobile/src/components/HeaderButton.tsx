import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/theme';

interface HeaderButtonProps {
  title: string;
  onPress: () => void;
  /** Show this Ionicons glyph instead of the title (the title stays the accessible label). */
  icon?: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel?: string;
  testID?: string;
}

/** Text (or icon) button for navigation headers (headerLeft / headerRight). */
export function HeaderButton({ title, onPress, icon, accessibilityLabel, testID }: HeaderButtonProps) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      hitSlop={8}
      testID={testID}
      style={({ pressed }) => ({ paddingHorizontal: spacing.md, opacity: pressed ? 0.6 : 1 })}
    >
      {icon ? (
        <Ionicons name={icon} size={24} color={colors.primary} />
      ) : (
        <Text style={[typography.body, { color: colors.primary, fontWeight: '600' }]}>{title}</Text>
      )}
    </Pressable>
  );
}
