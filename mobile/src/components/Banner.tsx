import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export type BannerTone = 'info' | 'warning' | 'error' | 'success';

interface BannerProps {
  tone?: BannerTone;
  title?: string;
  message: string;
  /** Optional actions (e.g. a link-style Button) rendered under the message. */
  children?: ReactNode;
  testID?: string;
}

export function Banner({ tone = 'info', title, message, children, testID }: BannerProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const palette = {
    info: { bg: colors.surface, fg: colors.text },
    warning: { bg: colors.warningSurface, fg: colors.warning },
    error: { bg: colors.dangerSurface, fg: colors.danger },
    success: { bg: colors.successSurface, fg: colors.success },
  }[tone];

  return (
    <View
      testID={testID}
      role={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[
        styles.box,
        { backgroundColor: palette.bg, borderColor: palette.fg, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
      ]}
    >
      {title ? <Text style={[typography.label, { color: palette.fg }]}>{title}</Text> : null}
      <Text style={[typography.body, { color: palette.fg }]}>{message}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth },
});
