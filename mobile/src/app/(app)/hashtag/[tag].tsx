import { Stack, useLocalSearchParams } from 'expo-router';

import { firstParam } from '@/components';
import { PostList } from '@/components/posts';
import { useHashtagPosts } from '@/features/posts';

export default function HashtagScreen() {
  const params = useLocalSearchParams<{ tag?: string | string[] }>();
  // Backend stores hashtags lowercased, without the '#'.
  const tag = (firstParam(params.tag) ?? '').replace(/^#/, '').toLowerCase();
  const result = useHashtagPosts(tag);
  return (
    <>
      <Stack.Screen options={{ title: `#${tag}` }} />
      <PostList result={result} testID="hashtag-posts" emptyTitle={`No posts with #${tag}`} />
    </>
  );
}
