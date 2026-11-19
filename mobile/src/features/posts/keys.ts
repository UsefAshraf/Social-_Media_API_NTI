import { normalizeTag } from '@/api/posts';

/** Every posts query key. Lists live under ['posts', 'list', …] and the detail under ['posts', 'detail', id]. */
export const postKeys = {
  all: ['posts'] as const,
  lists: () => ['posts', 'list'] as const,
  feed: () => ['posts', 'list', 'feed'] as const,
  discover: () => ['posts', 'list', 'discover'] as const,
  user: (userId: string) => ['posts', 'list', 'user', userId] as const,
  hashtags: () => ['posts', 'list', 'hashtag'] as const,
  hashtag: (tag: string) => ['posts', 'list', 'hashtag', normalizeTag(tag)] as const,
  trending: () => ['posts', 'list', 'trending'] as const,
  bookmarks: () => ['posts', 'list', 'bookmarks'] as const,
  details: () => ['posts', 'detail'] as const,
  detail: (postId: string) => ['posts', 'detail', postId] as const,
};
