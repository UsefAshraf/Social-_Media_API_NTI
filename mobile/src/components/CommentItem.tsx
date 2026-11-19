import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Comment } from '@/lib/posts';
import { useTheme } from '@/theme';

import { Avatar } from './Avatar';
import { plural } from './PostCard';
import { RelativeTime } from './RelativeTime';
import { RichText } from './RichText';

export interface CommentRow {
  comment: Comment;
  /** 0 = top-level, 1 = reply. */
  depth: 0 | 1;
}

/**
 * Flattens comments into display order: each top-level comment followed by its replies.
 * Threads are one level deep; a reply whose parent is missing is shown as top-level.
 */
export function threadComments(comments: readonly Comment[]): CommentRow[] {
  const ids = new Set(comments.map((c) => c.id));
  const replies = new Map<string, Comment[]>();
  const roots: Comment[] = [];
  for (const c of comments) {
    if (c.parentId && ids.has(c.parentId)) {
      const list = replies.get(c.parentId);
      if (list) list.push(c);
      else replies.set(c.parentId, [c]);
    } else {
      roots.push(c);
    }
  }
  const rows: CommentRow[] = [];
  for (const root of roots) {
    rows.push({ comment: root, depth: 0 });
    for (const r of replies.get(root.id) ?? []) rows.push({ comment: r, depth: 1 });
  }
  return rows;
}

interface CommentItemProps {
  row: CommentRow;
  canDelete: boolean;
  onLike: (comment: Comment) => void;
  onReply: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
}

function CommentItemImpl({ row, canDelete, onLike, onReply, onDelete }: CommentItemProps) {
  const { comment, depth } = row;
  const { colors, spacing, typography } = useTheme();
  const muted = [typography.caption, { color: colors.textMuted }];

  return (
    <View
      style={[styles.row, { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, paddingLeft: spacing.lg + depth * 44, gap: spacing.sm }]}
      testID={`comment-${comment.id}`}
      accessibilityLabel={depth ? `Reply by ${comment.author.username}` : `Comment by ${comment.author.username}`}
    >
      <Avatar uri={comment.author.avatar} username={comment.author.username} size={depth ? 28 : 34} />
      <View style={[styles.flex, { gap: spacing.xs }]}>
        <View style={[styles.inline, { gap: spacing.xs }]}>
          <Text style={[typography.label, { color: colors.text }]}>@{comment.author.username}</Text>
          <RelativeTime iso={comment.createdAt} style={muted} />
        </View>
        <RichText text={comment.content} />
        <View style={[styles.inline, { gap: spacing.lg }]}>
          <Pressable
            onPress={() => onLike(comment)}
            accessibilityRole="button"
            accessibilityLabel={`Like comment, ${plural(comment.likeCount, 'like')}`}
            accessibilityState={{ selected: comment.likedByMe }}
            hitSlop={8}
            testID={`comment-like-${comment.id}`}
          >
            <View style={[styles.inline, { gap: 4 }]}>
              <Ionicons
                name={comment.likedByMe ? 'heart' : 'heart-outline'}
                size={14}
                color={comment.likedByMe ? colors.like : colors.textMuted}
              />
              <Text style={[typography.caption, { color: comment.likedByMe ? colors.like : colors.textMuted }]}>
                {comment.likeCount}
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => onReply(comment)}
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${comment.author.username}`}
            hitSlop={8}
            testID={`comment-reply-${comment.id}`}
          >
            <Text style={muted}>Reply</Text>
          </Pressable>
          {canDelete ? (
            <Pressable
              onPress={() => onDelete(comment)}
              accessibilityRole="button"
              accessibilityLabel="Delete comment"
              hitSlop={8}
              testID={`comment-delete-${comment.id}`}
            >
              <Text style={[typography.caption, { color: colors.danger }]}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export const CommentItem = memo(CommentItemImpl);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  inline: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
