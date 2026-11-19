import { PostList } from '@/components/posts';
import { useFeed } from '@/features/posts';

export default function HomeScreen() {
  const feed = useFeed();
  return (
    <PostList
      result={feed}
      testID="home-feed"
      emptyTitle="Your feed is empty"
      emptyMessage="Follow people or check Discover to find posts."
    />
  );
}
