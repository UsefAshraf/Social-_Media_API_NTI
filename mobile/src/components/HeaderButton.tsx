import { Pressable, Text } from 'react-native';

import { useTheme } from '@/theme';

interface HeaderButtonProps {
  title: string;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

/** Text button for navigation headers (headerLeft / headerRight). */
export function HeaderButton({ title, onPress, accessibilityLabel, testID }: HeaderButtonProps) {
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
      <Text style={[typography.body, { color: colors.primary, fontWeight: '600' }]}>{title}</Text>
    </Pressable>
  );
}
