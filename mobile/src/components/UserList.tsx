import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useToggleFollow } from '@/features/users';
import type { UserListResult, UserSummary } from '@/lib/users';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { errorMessage } from './forms';
import { UserRow } from './UserRow';

interface UserListProps {
  result: UserListResult;
  emptyTitle?: string;
  emptyMessage?: string;
  header?: ReactElement | null;
  /** Blocked-accounts mode: rows show Unblock (no Follow) and aren't tappable. */
  onUnblock?: (user: UserSummary) => void;
  testID?: string;
}

const keyExtractor = (user: UserSummary) => user.id;

export function UserList({
  result,
  emptyTitle = 'No one here yet',
  emptyMessage,
  header = null,
  onUnblock,
  testID = 'user-list',
}: UserListProps) {
  const { users, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = result;
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const { toggle } = useToggleFollow();
  const [refreshing, setRefreshing] = useState(false);

  // Latest-ref so the memoised rows get stable handlers.
  const latest = useRef({ router, toggle, onUnblock });
  useLayoutEffect(() => {
    latest.current = { router, toggle, onUnblock };
  });
  const onOpen = useCallback(
    (u: UserSummary) => latest.current.router.push({ pathname: '/users/[id]', params: { id: u.id } }),
    [],
  );
  const onToggleFollow = useCallback(
    (u: UserSummary) => latest.current.toggle({ id: u.id, isFollowing: u.isFollowing }),
    [],
  );
  const unblock = useCallback((u: UserSummary) => latest.current.onUnblock?.(u), []);
  const blockedMode = !!onUnblock;

  const renderItem = useCallback<ListRenderItem<UserSummary>>(
    ({ item }) =>
      blockedMode ? (
        <UserRow user={item} onUnblock={unblock} />
      ) : (
        <UserRow user={item} onOpen={onOpen} onToggleFollow={onToggleFollow} />
      ),
    [blockedMode, unblock, onOpen, onToggleFollow],
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

  if (users.length === 0 && isLoading) {
    return (
      <View style={styles.flex} testID={`${testID}-loading`}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading people" />
        </View>
      </View>
    );
  }

  if (users.length === 0 && error) {
    return (
      <View style={styles.flex} testID={`${testID}-error`}>
        {header}
        <View style={[styles.center, { padding: spacing.xl, gap: spacing.md }]}>
          <Text style={[typography.heading, { color: colors.text }]}>Couldn't load this list</Text>
          <Text style={[typography.body, styles.centerText, { color: colors.textMuted }]}>{errorMessage(error)}</Text>
          <Button title="Try again" variant="secondary" onPress={() => refetch().catch(() => {})} />
        </View>
      </View>
    );
  }

  const footer = isFetchingNextPage ? (
    <View style={{ padding: spacing.lg }}>
      <ActivityIndicator color={colors.primary} accessibilityLabel="Loading more people" testID={`${testID}-footer`} />
    </View>
  ) : error && users.length > 0 ? (
    <View style={{ padding: spacing.lg }}>
      <Button title="Couldn't load more. Retry" variant="link" onPress={fetchNextPage} />
    </View>
  ) : null;

  return (
    <FlashList
      testID={testID}
      data={users}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
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
