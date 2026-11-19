import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  /** Safe-area edges to pad. Defaults to all; drop 'top' under a navigation header. */
  edges?: Edge[];
  /** Vertically center short content (auth forms). */
  centered?: boolean;
}

/** Safe-area + keyboard-avoiding + scrollable screen container. */
export function Screen({ children, edges = ['top', 'bottom', 'left', 'right'], centered }: ScreenProps) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { padding: spacing.xl, gap: spacing.lg },
            centered && styles.centered,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  centered: { justifyContent: 'center' },
});
