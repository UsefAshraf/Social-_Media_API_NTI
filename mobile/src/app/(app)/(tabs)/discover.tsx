import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components';
import { PostList } from '@/components/posts';
import { useDiscover, useTrendingPosts } from '@/features/posts';

type Segment = 'latest' | 'trending';

const SEGMENTS = [
  { value: 'latest', label: 'Latest' },
  { value: 'trending', label: 'Trending' },
] as const;

export default function DiscoverScreen() {
  const [segment, setSegment] = useState<Segment>('latest');
  return (
    <View style={styles.flex}>
      <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
      {/* Only the visible segment's hook is mounted, so only it fetches. */}
      {segment === 'latest' ? <LatestList /> : <TrendingList />}
    </View>
  );
}

function LatestList() {
  return <PostList result={useDiscover()} testID="discover-latest" emptyTitle="Nothing here yet" />;
}

function TrendingList() {
  return <PostList result={useTrendingPosts()} testID="discover-trending" emptyTitle="Nothing trending right now" />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
