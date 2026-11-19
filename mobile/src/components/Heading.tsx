import { Text } from 'react-native';

import { useTheme } from '@/theme';

interface HeadingProps {
  title: string;
  subtitle?: string;
}

/** Screen title + optional muted subtitle. */
export function Heading({ title, subtitle }: HeadingProps) {
  const { colors, typography, spacing } = useTheme();
  return (
    <>
      <Text role="heading" style={[typography.title, { color: colors.text }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.sm }]}>{subtitle}</Text>
      ) : null}
    </>
  );
}
