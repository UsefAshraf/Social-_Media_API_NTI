import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View
      role="tablist"
      style={[styles.row, { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.xs, margin: spacing.md }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            role="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              { borderRadius: radius.sm, paddingVertical: spacing.sm },
              selected && { backgroundColor: colors.background },
            ]}
          >
            <Text style={[typography.label, { color: selected ? colors.text : colors.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  segment: { flex: 1, alignItems: 'center' },
});
