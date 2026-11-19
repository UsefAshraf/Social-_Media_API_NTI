import { useRouter } from 'expo-router';
import { memo, useMemo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import type { Mention } from '@/lib/posts';
import { useTheme } from '@/theme';

import { parseRichText } from './parseRichText';

interface RichTextProps {
  text: string;
  /** Resolved @mentions (username → user id). Unknown names render styled but not tappable. */
  mentions?: readonly Mention[];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  testID?: string;
}

const NO_MENTIONS: readonly Mention[] = [];

/** Post / comment text with tappable #hashtags (→ /hashtag/[tag]) and @mentions (→ /users/[id]). */
export const RichText = memo(function RichText({
  text,
  mentions = NO_MENTIONS,
  style,
  numberOfLines,
  testID,
}: RichTextProps) {
  const router = useRouter();
  const { colors, typography } = useTheme();
  const segments = useMemo(() => parseRichText(text, mentions), [text, mentions]);

  return (
    <Text style={[typography.body, { color: colors.text }, style]} numberOfLines={numberOfLines} testID={testID}>
      {segments.map((s, i) => {
        if (s.kind === 'text') return s.text;
        if (s.kind === 'hashtag') {
          return (
            <Text
              key={i}
              style={{ color: colors.primary }}
              accessibilityRole="link"
              accessibilityLabel={`Hashtag ${s.tag}`}
              onPress={() => router.push({ pathname: '/hashtag/[tag]', params: { tag: s.tag } })}
            >
              {s.text}
            </Text>
          );
        }
        const userId = s.userId;
        if (!userId) {
          return (
            <Text key={i} style={{ color: colors.primary, opacity: 0.75 }} testID="mention-unresolved">
              {s.text}
            </Text>
          );
        }
        return (
          <Text
            key={i}
            style={{ color: colors.primary, fontWeight: '600' }}
            accessibilityRole="link"
            accessibilityLabel={`Profile of ${s.username}`}
            onPress={() => router.push({ pathname: '/users/[id]', params: { id: userId } })}
          >
            {s.text}
          </Text>
        );
      })}
    </Text>
  );
});
