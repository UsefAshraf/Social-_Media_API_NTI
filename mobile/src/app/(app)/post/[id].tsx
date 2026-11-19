import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { useCallback, useContext, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toAppError, useAuth } from '@/auth';
import { Button, errorMessage, firstParam } from '@/components';
import { CommentItem, PostCard, threadComments, usePostActions, type CommentRow } from '@/components/posts';
import { useAddComment, useDeleteComment, usePost, useToggleCommentLike } from '@/features/posts';
import type { Comment } from '@/lib/posts';
import { useTheme } from '@/theme';

const MAX_COMMENT = 500;

const keyExtractor = (row: CommentRow) => row.comment.id;
const getItemType = (row: CommentRow) => (row.depth ? 'reply' : 'comment');

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const postId = firstParam(params.id) ?? '';
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();
  const headerHeight = useContext(HeaderHeightContext) ?? 0;

  const { post, isLoading, error, refetch } = usePost(postId);
  const myId = useAuth((s) => s.user?.id);
  const actions = usePostActions({
    onDeleted: () => (router.canGoBack() ? router.back() : router.replace('/')),
  });
  const likeComment = useToggleCommentLike(postId);
  const { deleteComment } = useDeleteComment(postId);

  const [replyTo, setReplyTo] = useState<{ parentId: string; username: string } | null>(null);

  const rows = useMemo(() => threadComments(post?.comments ?? []), [post?.comments]);

  // Stable handlers for the memoised comment rows.
  const toggleCommentLike = likeComment.toggle;
  const onLike = useCallback((c: Comment) => toggleCommentLike(c.id), [toggleCommentLike]);
  const onReply = useCallback(
    // Threads are one level deep: replying to a reply attaches to its top-level parent.
    (c: Comment) => setReplyTo({ parentId: c.parentId ?? c.id, username: c.author.username }),
    [],
  );
  const onDelete = useCallback(
    (c: Comment) =>
      Alert.alert('Delete comment?', "This can't be undone.", [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteComment(c.id).catch((e: unknown) =>
              Alert.alert("Couldn't delete comment", errorMessage(toAppError(e))),
            );
          },
        },
      ]),
    [deleteComment],
  );

  const renderItem = useCallback<ListRenderItem<CommentRow>>(
    ({ item }) => (
      <CommentItem
        row={item}
        canDelete={!!myId && item.comment.author.id === myId}
        onLike={onLike}
        onReply={onReply}
        onDelete={onDelete}
      />
    ),
    [myId, onLike, onReply, onDelete],
  );

  if (!post && isLoading) {
    return (
      <View style={styles.center} testID="post-loading">
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading post" />
      </View>
    );
  }

  if (!post) {
    const unavailable = !error || error.status === 404 || error.status === 403;
    return (
      <View style={[styles.center, { padding: spacing.xl, gap: spacing.md }]} testID="post-unavailable">
        <Text style={[typography.heading, { color: colors.text }]}>
          {unavailable ? 'Post not available' : "Couldn't load post"}
        </Text>
        <Text style={[typography.body, styles.centerText, { color: colors.textMuted }]}>
          {unavailable ? 'It may have been deleted, or you no longer have access to it.' : errorMessage(error)}
        </Text>
        {unavailable ? (
          <Button title="Go back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        ) : (
          <Button title="Try again" variant="secondary" onPress={() => refetch()} />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <View style={styles.flex}>
        <FlashList
          data={rows}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          extraData={myId}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListHeaderComponent={
            <View>
              <PostCard post={post} actions={actions} variant="detail" />
              <Text style={[typography.label, { color: colors.textMuted, padding: spacing.lg, paddingBottom: 0 }]}>
                {rows.length ? 'Comments' : 'No comments yet — start the conversation.'}
              </Text>
            </View>
          }
          testID="comments-list"
        />
      </View>
      <CommentComposer postId={postId} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onSent={() => setReplyTo(null)} />
    </KeyboardAvoidingView>
  );
}

interface CommentComposerProps {
  postId: string;
  replyTo: { parentId: string; username: string } | null;
  onCancelReply: () => void;
  onSent: () => void;
}

function CommentComposer({ postId, replyTo, onCancelReply, onSent }: CommentComposerProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { addComment, isPending } = useAddComment(postId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const trimmed = text.trim();
  const over = text.length > MAX_COMMENT;
  const canSend = trimmed.length > 0 && !over && !isPending;

  async function send() {
    if (!canSend) return;
    setError(null);
    try {
      await addComment(replyTo ? { content: trimmed, parentId: replyTo.parentId } : { content: trimmed });
      setText('');
      onSent();
    } catch (e) {
      setError(errorMessage(toAppError(e)));
    }
  }

  return (
    <View
      style={[
        styles.composer,
        { borderColor: colors.border, backgroundColor: colors.background, padding: spacing.md, paddingBottom: spacing.md + insets.bottom, gap: spacing.xs },
      ]}
    >
      {replyTo ? (
        <View style={[styles.inline, { gap: spacing.sm }]} testID="replying-to">
          <Text style={[typography.caption, styles.flex, { color: colors.textMuted }]}>Replying to @{replyTo.username}</Text>
          <Pressable onPress={onCancelReply} accessibilityRole="button" accessibilityLabel="Cancel reply" hitSlop={8}>
            <Text style={[typography.caption, { color: colors.primary }]}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <Text style={[typography.caption, { color: colors.danger }]} role="alert" testID="comment-error">
          {error}
        </Text>
      ) : null}
      <View style={[styles.inline, { gap: spacing.sm }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={replyTo ? `Reply to @${replyTo.username}` : 'Add a comment'}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Comment"
          multiline
          style={[
            typography.body,
            styles.input,
            { color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
          ]}
          testID="comment-input"
        />
        <Button title="Send" onPress={send} disabled={!canSend} loading={isPending} testID="comment-send" />
      </View>
      <Text
        style={[typography.caption, styles.counter, { color: over ? colors.danger : colors.textMuted }]}
        accessibilityLabel={`${text.length} of ${MAX_COMMENT} characters`}
        testID="comment-counter"
      >
        {text.length}/{MAX_COMMENT}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth },
  inline: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, maxHeight: 120 },
  counter: { alignSelf: 'flex-end' },
});
