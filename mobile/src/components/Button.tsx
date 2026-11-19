import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'link';

interface ButtonProps {
  title: string;
  /** May be async; the returned promise is ignored (show progress via `loading`). */
  onPress: () => unknown;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const inactive = disabled || loading;

  const container =
    variant === 'primary'
      ? { backgroundColor: colors.primary, borderColor: colors.primary }
      : variant === 'secondary'
        ? { backgroundColor: 'transparent', borderColor: colors.border }
        : { backgroundColor: 'transparent', borderColor: 'transparent' };
  const textColor = variant === 'primary' ? colors.onPrimary : colors.primary;

  return (
    <Pressable
      onPress={() => {
        void onPress();
      }}
      disabled={inactive}
      testID={testID}
      accessibilityRole={variant === 'link' ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        container,
        variant === 'link'
          ? { paddingVertical: spacing.sm }
          : { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md },
        { opacity: inactive ? 0.6 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[typography.body, styles.text, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  text: { fontWeight: '600' },
});
