import { useRouter } from 'expo-router';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Alert } from 'react-native';

import { toAppError } from '@/auth';
import { useDeletePost, useToggleBookmark, useToggleLike } from '@/features/posts';
import type { Author, Post } from '@/lib/posts';

import { errorMessage } from './forms';

/** Everything a PostCard can do. The object is referentially stable for the component's lifetime. */
export interface PostActions {
  toggleLike(post: Post): void;
  toggleBookmark(post: Post): void;
  openPost(post: Post): void;
  openAuthor(author: Author): void;
  editPost(post: Post): void;
  /** Asks for confirmation, then deletes. */
  confirmDelete(post: Post): void;
}

interface Options {
  /** Called after a successful delete (e.g. go back from the detail screen). */
  onDeleted?: (post: Post) => void;
}

/**
 * Wraps the data-layer mutations once per list/screen instead of once per row, and returns
 * a stable object (latest-ref pattern), so memoised rows never re-render because of it.
 */
export function usePostActions(options: Options = {}): PostActions {
  const router = useRouter();
  const like = useToggleLike();
  const bookmark = useToggleBookmark();
  const del = useDeletePost();

  const latest = useRef({ router, like, bookmark, del, options });
  useLayoutEffect(() => {
    latest.current = { router, like, bookmark, del, options };
  });

  return useMemo<PostActions>(
    () => ({
      toggleLike: (post) => latest.current.like.toggle(post),
      toggleBookmark: (post) => latest.current.bookmark.toggle(post),
      openPost: (post) => latest.current.router.push({ pathname: '/post/[id]', params: { id: post.id } }),
      openAuthor: (author) => latest.current.router.push({ pathname: '/users/[id]', params: { id: author.id } }),
      editPost: (post) => latest.current.router.push({ pathname: '/compose', params: { postId: post.id } }),
      confirmDelete: (post) => {
        Alert.alert('Delete post?', "This can't be undone.", [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              latest.current.del
                .deletePost(post.id)
                .then(() => latest.current.options.onDeleted?.(post))
                .catch((e: unknown) => Alert.alert("Couldn't delete post", errorMessage(toAppError(e))));
            },
          },
        ]);
      },
    }),
    [],
  );
}
