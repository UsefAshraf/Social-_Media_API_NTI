import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { toAppError } from '@/auth';
import { Button, errorMessage, firstParam, FormError, HeaderButton, ProgressBar, Screen } from '@/components';
import { pickImage, useCreatePost, usePost, useUpdatePost } from '@/features/posts';
import type { PickedImage, Post } from '@/lib/posts';
import { useTheme } from '@/theme';

const MAX_POST = 1000;

// Modal. /compose = new post; /compose?postId=<id> = edit that post.
export default function ComposeScreen() {
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const postId = firstParam(params.postId);
  return postId ? <EditPost postId={postId} /> : <ComposeForm />;
}

function useClose() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/'));
}

function EditPost({ postId }: { postId: string }) {
  const { post, isLoading, error } = usePost(postId);
  const { colors, spacing, typography } = useTheme();
  const close = useClose();

  if (post) return <ComposeForm initial={post} />;
  return (
    <View style={[styles.center, { padding: spacing.xl, gap: spacing.md }]}>
      <Stack.Screen options={{ title: 'Edit post' }} />
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading post" />
      ) : (
        <>
          <Text style={[typography.heading, { color: colors.text }]}>Post not available</Text>
          {error ? <Text style={[typography.body, { color: colors.textMuted }]}>{errorMessage(error)}</Text> : null}
          <Button title="Close" variant="secondary" onPress={close} />
        </>
      )}
    </View>
  );
}

/** The form. With `initial` it edits that post, otherwise it creates one. */
function ComposeForm({ initial }: { initial?: Post }) {
  const editing = !!initial;
  const { colors, spacing, radius, typography } = useTheme();
  const close = useClose();
  const create = useCreatePost();
  const update = useUpdatePost();
  const mutation = editing ? update : create;

  const [content, setContent] = useState(initial?.content ?? '');
  // A newly picked image (replaces any existing one).
  const [picked, setPicked] = useState<PickedImage | null>(null);
  // The post's current image, until the user removes it.
  const [existing, setExisting] = useState<string | null>(initial?.image ?? initial?.thumbnail ?? null);
  const [localError, setLocalError] = useState<string | null>(null);

  const trimmed = content.trim();
  const canSubmit = trimmed.length > 0 && content.length <= MAX_POST && !mutation.isPending;
  const previewUri = picked?.uri ?? existing;

  async function attach(source: 'camera' | 'library') {
    setLocalError(null);
    try {
      const img = await pickImage(source);
      if (img) setPicked(img);
    } catch (e) {
      setLocalError(errorMessage(toAppError(e)));
    }
  }

  function removeImage() {
    setPicked(null);
    setExisting(null);
  }

  async function submit() {
    if (!canSubmit) return;
    setLocalError(null);
    mutation.reset();
    try {
      if (initial) {
        const hadImage = !!(initial.image ?? initial.thumbnail);
        // undefined = keep the current image, null = remove it.
        const image = picked ?? (hadImage && !existing ? null : undefined);
        await update.updatePost({
          postId: initial.id,
          content: trimmed,
          ...(image !== undefined ? { image } : {}),
        });
      } else {
        await create.createPost(picked ? { content: trimmed, image: picked } : { content: trimmed });
      }
      close();
    } catch (e) {
      // The hook's `error` usually carries this too; keep a local copy in case it's reset.
      setLocalError(errorMessage(toAppError(e)));
    }
  }

  const shownError = mutation.error ? errorMessage(mutation.error) : localError;

  return (
    <>
      <Stack.Screen
        options={{
          title: editing ? 'Edit post' : 'New post',
          headerLeft: () => <HeaderButton title="Cancel" onPress={close} />,
        }}
      />
      <Screen edges={['bottom', 'left', 'right']}>
        <View style={{ gap: spacing.xs }}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="What's happening?"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Post content"
            multiline
            autoFocus={!editing}
            maxLength={MAX_POST}
            editable={!mutation.isPending}
            textAlignVertical="top"
            style={[
              typography.body,
              styles.input,
              { color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
            ]}
            testID="compose-input"
          />
          <Text
            style={[typography.caption, styles.counter, { color: content.length >= MAX_POST ? colors.danger : colors.textMuted }]}
            accessibilityLabel={`${content.length} of ${MAX_POST} characters`}
            testID="compose-counter"
          >
            {content.length}/{MAX_POST}
          </Text>
        </View>

        {previewUri ? (
          <View style={[styles.preview, { borderRadius: radius.md, backgroundColor: colors.placeholder }]} testID="image-preview">
            <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Selected image" />
            <Pressable
              onPress={removeImage}
              disabled={mutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Remove image"
              hitSlop={8}
              style={[styles.remove, { borderRadius: radius.pill }]}
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.row, { gap: spacing.md }]}>
          <View style={styles.flex}>
            <Button
              title="Camera"
              variant="secondary"
              onPress={() => attach('camera')}
              disabled={mutation.isPending}
              accessibilityLabel={previewUri ? 'Replace image from camera' : 'Take a photo'}
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Library"
              variant="secondary"
              onPress={() => attach('library')}
              disabled={mutation.isPending}
              accessibilityLabel={previewUri ? 'Replace image from library' : 'Choose from library'}
            />
          </View>
        </View>

        {mutation.progress !== null ? <ProgressBar progress={mutation.progress} /> : null}
        <FormError message={shownError} />

        <Button
          title={editing ? 'Save' : 'Post'}
          onPress={submit}
          disabled={!canSubmit}
          loading={mutation.isPending}
          testID="compose-submit"
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 140 },
  counter: { alignSelf: 'flex-end' },
  preview: { width: '100%', aspectRatio: 4 / 3, overflow: 'hidden' },
  remove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
});
