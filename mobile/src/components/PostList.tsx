import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback, useState, type ReactElement } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';

import type { Post, PostListResult } from '@/lib/posts';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { errorMessage } from './forms';
import { PostCard } from './PostCard';
import { usePostActions } from './usePostActions';

interface PostListProps {
  result: PostListResult;
  emptyTitle?: string;
  emptyMessage?: string;
  /** Rendered above the posts (scrolls with them). */
  header?: ReactElement | null;
  testID?: string;
}

const keyExtractor = (post: Post) => post.id;
// Separate recycling pools so text-only rows aren't recycled into image rows (and vice versa).
const getItemType = (post: Post) => (post.thumbnail || post.image ? 'image' : 'text');

export function PostList({
  result,
  emptyTitle = 'No posts yet',
  emptyMessage,
  header = null,
  testID = 'post-list',
}: PostListProps) {
  const { posts, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = result;
  const { colors, spacing, typography } = useTheme();
  const actions = usePostActions();
  // Only show the pull-to-refresh spinner for user-initiated refreshes, not background refetches.
  const [refreshing, setRefreshing] = useState(false);

  const renderItem = useCallback<ListRenderItem<Post>>(
    ({ item }) => <PostCard post={item} actions={actions} />,
    [actions],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetch()
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [refetch]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !error) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, error, fetchNextPage]);

  if (posts.length === 0 && isLoading) {
    return (
      <View style={styles.flex} testID={`${testID}-loading`}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading posts" />
        </View>
      </View>
    );
  }

  if (posts.length === 0 && error) {
    return (
      <View style={styles.flex} testID={`${testID}-error`}>
        {header}
        <View style={[styles.center, { padding: spacing.xl, gap: spacing.md }]}>
          <Text style={[typography.heading, { color: colors.text }]}>Couldn't load posts</Text>
          <Text style={[typography.body, styles.centerText, { color: colors.textMuted }]}>{errorMessage(error)}</Text>
          <Button title="Try again" variant="secondary" onPress={() => refetch().catch(() => {})} />
        </View>
      </View>
    );
  }

  const footer = isFetchingNextPage ? (
    <View style={{ padding: spacing.lg }}>
      <ActivityIndicator color={colors.primary} accessibilityLabel="Loading more posts" testID={`${testID}-footer`} />
    </View>
  ) : error && posts.length > 0 ? (
    <View style={{ padding: spacing.lg }}>
      <Button title="Couldn't load more. Retry" variant="link" onPress={fetchNextPage} />
    </View>
  ) : null;

  return (
    <FlashList
      testID={testID}
      data={posts}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={
        <View style={[styles.empty, { padding: spacing.xl, gap: spacing.sm }]} testID={`${testID}-empty`}>
          <Text style={[typography.heading, { color: colors.text }]}>{emptyTitle}</Text>
          {emptyMessage ? (
            <Text style={[typography.body, styles.centerText, { color: colors.textMuted }]}>{emptyMessage}</Text>
          ) : null}
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  empty: { alignItems: 'center' },
});
