// Post shapes as the UI sees them. The data layer (src/api/posts.ts) maps the raw
// backend documents (_id, likes: string[], relative /uploads paths) into these.

export interface Author {
  id: string;
  username: string;
  avatar: string | null; // absolute URL or null
}

export interface Comment {
  id: string;
  author: Author;
  content: string;
  parentId: string | null; // set on replies; threads are one level deep
  likeCount: number;
  likedByMe: boolean;
  createdAt: string; // ISO
}

export interface Mention {
  id: string;
  username: string;
}

export interface Post {
  id: string;
  author: Author;
  content: string;
  image: string | null; // absolute URL
  thumbnail: string | null; // absolute URL, may be null even when image is set
  likeCount: number;
  likedByMe: boolean;
  bookmarked: boolean;
  comments: Comment[];
  commentCount: number;
  hashtags: string[];
  mentions: Mention[];
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
}

/** An image picked and already compressed for upload (JPEG, ≤ 5MB). */
export interface PickedImage {
  uri: string;
  width: number;
  height: number;
  mimeType: 'image/jpeg' | 'image/png';
  fileSize: number | null;
}

/** What every post-list hook returns. */
export interface PostListResult {
  posts: Post[];
  isLoading: boolean; // first page
  error: import('./contracts').AppError | null;
  refetch: () => Promise<unknown>;
  isRefetching: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}
