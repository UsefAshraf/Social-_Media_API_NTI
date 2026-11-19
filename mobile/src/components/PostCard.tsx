import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Post } from '@/lib/posts';
import { useTheme } from '@/theme';

import { Avatar } from './Avatar';
import { RelativeTime } from './RelativeTime';
import { RichText } from './RichText';
import type { PostActions } from './usePostActions';

export interface PostCardProps {
  post: Post;
  actions: PostActions;
  /** 'list' uses the thumbnail and opens the detail on tap; 'detail' shows the full image. */
  variant?: 'list' | 'detail';
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function PostCardImpl({ post, actions, variant = 'list' }: PostCardProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const inList = variant === 'list';
  const imageUri = inList ? (post.thumbnail ?? post.image) : (post.image ?? post.thumbnail);
  const open = inList ? () => actions.openPost(post) : undefined;

  const openMenu = () =>
    Alert.alert('Post options', undefined, [
      { text: 'Edit', onPress: () => actions.editPost(post) },
      { text: 'Delete', style: 'destructive', onPress: () => actions.confirmDelete(post) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <View
      style={[styles.card, { padding: spacing.lg, gap: spacing.sm, borderColor: colors.border }]}
      testID={`post-${post.id}`}
    >
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Pressable
          onPress={() => actions.openAuthor(post.author)}
          accessibilityRole="link"
          accessibilityLabel={`@${post.author.username}`}
          style={[styles.row, styles.flex, { gap: spacing.sm }]}
          hitSlop={4}
        >
          <Avatar uri={post.author.avatar} username={post.author.username} size={40} />
          <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
            @{post.author.username}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>·</Text>
          <RelativeTime iso={post.createdAt} style={[typography.caption, { color: colors.textMuted }]} />
        </Pressable>
        {post.isMine ? (
          <Pressable
            onPress={openMenu}
            accessibilityRole="button"
            accessibilityLabel="Post options"
            hitSlop={12}
            style={{ paddingHorizontal: spacing.sm }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {post.content ? (
        <Pressable onPress={open} disabled={!open} accessibilityRole={open ? 'button' : undefined}>
          <RichText text={post.content} mentions={post.mentions} numberOfLines={inList ? 12 : undefined} />
        </Pressable>
      ) : null}

      {imageUri ? (
        <Pressable
          onPress={open}
          disabled={!open}
          accessibilityRole={open ? 'imagebutton' : 'image'}
          accessibilityLabel="Post image"
          style={[styles.imageBox, { borderRadius: radius.md, backgroundColor: colors.placeholder }]}
        >
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
            contentFit={inList ? 'cover' : 'contain'}
            cachePolicy="memory-disk"
            recyclingKey={post.id}
            transition={150}
            accessible={false}
          />
        </Pressable>
      ) : null}

      <View style={[styles.row, styles.actions]}>
        <ActionButton
          icon={post.likedByMe ? 'heart' : 'heart-outline'}
          count={post.likeCount}
          color={post.likedByMe ? colors.like : colors.textMuted}
          label={`Like, ${plural(post.likeCount, 'like')}`}
          selected={post.likedByMe}
          onPress={() => actions.toggleLike(post)}
          testID="like-button"
        />
        <ActionButton
          icon="chatbubble-outline"
          count={post.commentCount}
          color={colors.textMuted}
          label={`Comments, ${plural(post.commentCount, 'comment')}`}
          onPress={inList ? () => actions.openPost(post) : undefined}
          testID="comments-button"
        />
        <ActionButton
          icon={post.bookmarked ? 'bookmark' : 'bookmark-outline'}
          color={post.bookmarked ? colors.primary : colors.textMuted}
          label={post.bookmarked ? 'Remove bookmark' : 'Bookmark'}
          selected={post.bookmarked}
          onPress={() => actions.toggleBookmark(post)}
          testID="bookmark-button"
        />
      </View>
    </View>
  );
}

interface ActionButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  count?: number;
  color: string;
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}

function ActionButton({ icon, count, color, label, selected, onPress, testID }: ActionButtonProps) {
  const { typography, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={8}
      testID={testID}
      style={({ pressed }) => [styles.row, styles.action, { gap: spacing.xs, opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
      {count !== undefined ? <Text style={[typography.caption, { color }]}>{count}</Text> : null}
    </Pressable>
  );
}

/** Re-render only when something the card shows changes (actions is stable by contract). */
export function arePostCardPropsEqual(prev: PostCardProps, next: PostCardProps): boolean {
  const a = prev.post;
  const b = next.post;
  return (
    prev.variant === next.variant &&
    prev.actions === next.actions &&
    (a === b ||
      (a.id === b.id &&
        a.updatedAt === b.updatedAt &&
        a.likeCount === b.likeCount &&
        a.likedByMe === b.likedByMe &&
        a.bookmarked === b.bookmarked &&
        a.commentCount === b.commentCount))
  );
}

export const PostCard = memo(PostCardImpl, arePostCardPropsEqual);

const styles = StyleSheet.create({
  card: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  imageBox: { width: '100%', aspectRatio: 4 / 3, overflow: 'hidden' },
  actions: { justifyContent: 'space-between', paddingTop: 4 },
  action: { minHeight: 32, minWidth: 56 },
});
