import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
  label: string;
  error?: string | null;
  /** Password field: input is masked, with a Show/Hide toggle. */
  secure?: boolean;
  ref?: Ref<TextInputInstance>;
}

export function TextField({ label, error, secure, ref, editable = true, ...inputProps }: TextFieldProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [hidden, setHidden] = useState(true);
  const hasError = !!error;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          {
            borderColor: hasError ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            opacity: editable ? 1 : 0.6,
          },
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={hasError ? error : undefined}
          aria-invalid={hasError}
          editable={editable}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && hidden}
          autoCapitalize={secure ? 'none' : inputProps.autoCapitalize}
          autoCorrect={secure ? false : inputProps.autoCorrect}
          style={[typography.body, styles.input, { color: colors.text, padding: spacing.md }]}
          {...inputProps}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`}
            hitSlop={8}
            style={{ paddingHorizontal: spacing.md }}
          >
            <Text style={[typography.label, { color: colors.primary }]}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        ) : null}
      </View>
      {hasError ? (
        <Text
          style={[typography.caption, { color: colors.danger }]}
          accessibilityLiveRegion="polite"
          role="alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  input: { flex: 1 },
});
