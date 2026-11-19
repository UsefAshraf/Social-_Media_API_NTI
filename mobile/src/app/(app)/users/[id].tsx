import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { Avatar, firstParam } from '@/components';
import { PostList } from '@/components/posts';
import { useUserPosts } from '@/features/posts';
import { useTheme } from '@/theme';

// Placeholder until Phase 3 (profile, follow, bio): the user's posts.
export default function UserScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id) ?? '';
  const result = useUserPosts(id);
  const { colors, spacing, typography } = useTheme();
  const author = result.posts[0]?.author;

  return (
    <>
      <Stack.Screen options={{ title: author ? `@${author.username}` : 'Profile' }} />
      <PostList
        result={result}
        testID="user-posts"
        emptyTitle="No posts yet"
        header={
          <View style={{ padding: spacing.lg, gap: spacing.sm, alignItems: 'center' }}>
            {author ? <Avatar uri={author.avatar} username={author.username} size={64} /> : null}
            <Text style={[typography.caption, { color: colors.textMuted }]}>Profile coming in Phase 3</Text>
          </View>
        }
      />
    </>
  );
}
