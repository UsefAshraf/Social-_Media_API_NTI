import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

/** Determinate progress bar; `progress` is 0..1. */
export function ProgressBar({ progress, label = 'Uploading' }: { progress: number; label?: string }) {
  const { colors, radius, spacing, typography } = useTheme();
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <View
      style={{ gap: spacing.xs }}
      role="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      testID="upload-progress"
    >
      <View style={[styles.track, { backgroundColor: colors.surface, borderRadius: radius.pill }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.primary, borderRadius: radius.pill }]} />
      </View>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        {label} {pct}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, overflow: 'hidden' },
  fill: { height: '100%' },
});
