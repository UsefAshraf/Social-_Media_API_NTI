// Posts endpoints + mapping from raw backend documents to the UI shapes in '@/lib/posts'.
// Every function throws AppError on failure.
import type { AxiosProgressEvent, AxiosRequestConfig } from 'axios';

import { API_URL } from '@/lib/config';
import type { Author, Comment, Mention, PickedImage, Post } from '@/lib/posts';

import { api, http } from './client';
import { toAppError } from './errors';

// ---------------------------------------------------------------------------
// Raw shapes (what the backend sends). Loose on purpose: older payloads differ.
// ---------------------------------------------------------------------------

type RawId = string | { _id?: unknown; id?: unknown } | null | undefined;

export interface RawUser {
  _id?: string;
  id?: string;
  username?: string;
  avatar?: string | null;
}

export interface RawComment {
  _id: string;
  author: RawUser | string | null;
  content: string;
  parentId?: string | null;
  likes?: RawId[];
  createdAt: string;
}

export interface RawPost {
  _id: string;
  content?: string;
  image?: string | null;
  thumbnail?: string | null;
  author: RawUser | string | null;
  likes?: RawId[];
  /** Present on newer payloads; trending items carry it without a `comments` array. */
  commentCount?: number;
  comments?: RawComment[];
  hashtags?: string[];
  mentions?: (RawUser | string)[];
  bookmarked?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface RawPagination {
  limit?: number;
  nextCursor?: string | null;
  page?: number;
  pages?: number;
  total?: number;
}

interface ListEnvelope {
  data?: RawPost[];
  pagination?: RawPagination;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/** Resolves a backend media path to an absolute URL. '' / null → null; relative paths → API_URL + path. */
export function resolveMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v; // http(s):, file:, data:, content: …
  if (v.startsWith('//')) return `https:${v}`;
  return `${API_URL}${v.startsWith('/') ? '' : '/'}${v}`;
}

/** A Mongo id from a string, populated doc ({ _id }) or { id }; '' when absent. */
export function idOf(value: RawId | unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const o = value as { _id?: unknown; id?: unknown };
    const v = o._id ?? o.id;
    if (v !== undefined && v !== null) return String(v);
  }
  return '';
}

export function mapAuthor(raw: RawUser | string | null | undefined): Author {
  if (!raw || typeof raw === 'string') return { id: raw ?? '', username: '', avatar: null };
  return { id: idOf(raw), username: raw.username ?? '', avatar: resolveMediaUrl(raw.avatar) };
}

function mapMention(raw: RawUser | string): Mention {
  if (typeof raw === 'string') return { id: raw, username: '' };
  return { id: idOf(raw), username: raw.username ?? '' };
}

function likeState(likes: RawId[] | undefined, viewerId: string | null | undefined) {
  const ids = Array.isArray(likes) ? likes.map(idOf) : [];
  return { likeCount: ids.length, likedByMe: !!viewerId && ids.includes(viewerId) };
}

export function mapComment(raw: RawComment, viewerId: string | null | undefined): Comment {
  return {
    id: idOf(raw._id),
    author: mapAuthor(raw.author),
    content: raw.content ?? '',
    parentId: raw.parentId ? idOf(raw.parentId) : null,
    ...likeState(raw.likes, viewerId),
    createdAt: raw.createdAt,
  };
}

export function mapPost(raw: RawPost, viewerId: string | null | undefined): Post {
  const author = mapAuthor(raw.author);
  const comments = Array.isArray(raw.comments) ? raw.comments.map((c) => mapComment(c, viewerId)) : [];
  return {
    id: idOf(raw._id),
    author,
    content: raw.content ?? '',
    image: resolveMediaUrl(raw.image),
    thumbnail: resolveMediaUrl(raw.thumbnail),
    ...likeState(raw.likes, viewerId),
    bookmarked: raw.bookmarked === true,
    comments,
    commentCount: typeof raw.commentCount === 'number' ? raw.commentCount : comments.length,
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags : [],
    mentions: Array.isArray(raw.mentions) ? raw.mentions.map(mapMention) : [],
    isMine: !!viewerId && author.id === viewerId,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt ?? raw.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** Where the next page starts: a cursor (preferred) or a page number (older endpoints). `{}` = first page. */
export interface PageParam {
  cursor?: string;
  page?: number;
}

export interface PostPage {
  posts: Post[];
  /** null = no more pages. */
  next: PageParam | null;
}

export const PAGE_SIZE = 20;

export function nextPageParam(pagination: RawPagination | undefined, received: number): PageParam | null {
  if (!pagination || received === 0) return null;
  if (pagination.nextCursor !== undefined) {
    return pagination.nextCursor ? { cursor: pagination.nextCursor } : null;
  }
  if (typeof pagination.page === 'number' && typeof pagination.pages === 'number') {
    return pagination.page < pagination.pages ? { page: pagination.page + 1 } : null;
  }
  return null;
}

async function getList(
  url: string,
  params: Record<string, string | number | undefined>,
  viewerId: string | null | undefined,
  paged = true,
): Promise<PostPage> {
  try {
    const res = await api.get<ListEnvelope>(url, { params });
    const raw = Array.isArray(res.data?.data) ? res.data.data : [];
    const posts = raw.map((p) => mapPost(p, viewerId));
    return { posts, next: paged ? nextPageParam(res.data?.pagination, raw.length) : null };
  } catch (e) {
    throw toAppError(e);
  }
}

function pageParams(param: PageParam | undefined, limit = PAGE_SIZE) {
  if (param?.cursor) return { cursor: param.cursor, limit };
  if (param?.page) return { page: param.page, limit };
  return { limit };
}

/** GET /posts/feed — following + own. */
export const getFeed = (param: PageParam | undefined, viewerId: string | null | undefined) =>
  getList('/posts/feed', pageParams(param), viewerId);

/** GET /posts — everyone. */
export const getDiscover = (param: PageParam | undefined, viewerId: string | null | undefined) =>
  getList('/posts', pageParams(param), viewerId);

/** GET /posts/user/:userId — cursor, falling back to page-based pagination. */
export const getUserPosts = (userId: string, param: PageParam | undefined, viewerId: string | null | undefined) =>
  getList(`/posts/user/${encodeURIComponent(userId)}`, pageParams(param), viewerId);

export const normalizeTag = (tag: string) => tag.trim().replace(/^#+/, '').toLowerCase();

/** GET /posts/hashtag/:tag — cursor, falling back to page-based pagination. Leading '#' is stripped. */
export const getHashtagPosts = (tag: string, param: PageParam | undefined, viewerId: string | null | undefined) =>
  getList(`/posts/hashtag/${encodeURIComponent(normalizeTag(tag))}`, pageParams(param), viewerId);

/** GET /posts/trending — single page. */
export const getTrendingPosts = (viewerId: string | null | undefined, opts: { hours?: number; limit?: number } = {}) =>
  getList('/posts/trending', { hours: opts.hours, limit: opts.limit ?? PAGE_SIZE }, viewerId, false);

/** GET /posts/bookmarks — page-based. */
export const getBookmarks = (param: PageParam | undefined, viewerId: string | null | undefined) =>
  getList('/posts/bookmarks', pageParams(param), viewerId);

// ---------------------------------------------------------------------------
// Single post + mutations
// ---------------------------------------------------------------------------

export async function getPost(id: string, viewerId: string | null | undefined): Promise<Post> {
  return mapPost(await http.get<RawPost>(`/posts/${encodeURIComponent(id)}`), viewerId);
}

export interface UploadOptions {
  /** Called with 0..1 while a multipart body uploads. */
  onProgress?: (fraction: number) => void;
}

const UPLOAD_TIMEOUT_MS = 120_000;

function extensionFor(mime: PickedImage['mimeType']) {
  return mime === 'image/png' ? 'png' : 'jpg';
}

/** Builds the multipart body: text field `content` (if given) + file field `image` in React Native's `{ uri, name, type }` form. */
export function buildPostFormData(content: string | undefined, image: PickedImage): FormData {
  const form = new FormData();
  if (content !== undefined) form.append('content', content);
  form.append('image', imageFilePart(image, 'post'));
  return form;
}

/** A picked image as a React Native FormData file part (`{ uri, name, type }`). */
export function imageFilePart(image: PickedImage, baseName: string): Blob {
  const file = { uri: image.uri, name: `${baseName}.${extensionFor(image.mimeType)}`, type: image.mimeType };
  return file as unknown as Blob;
}

/** Axios config for a multipart upload: keeps FormData un-serialised, long timeout, 0..1 progress. */
export function multipartConfig(opts: UploadOptions | undefined): AxiosRequestConfig {
  return {
    // The client's default Content-Type is application/json, which would make axios JSON-encode the FormData.
    // 'multipart/form-data' stops that; axios' xhr adapter then removes the header for React Native FormData
    // so the native layer sets it with the boundary.
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_TIMEOUT_MS,
    onUploadProgress: opts?.onProgress
      ? (e: AxiosProgressEvent) => {
          const fraction = e.progress ?? (e.total ? e.loaded / e.total : undefined);
          if (fraction !== undefined && Number.isFinite(fraction)) opts.onProgress!(Math.min(1, Math.max(0, fraction)));
        }
      : undefined,
  };
}

export interface CreatePostInput {
  content: string;
  image?: PickedImage;
}

/** POST /posts — JSON, or multipart when an image is attached. 403 for unverified users carries the server message. */
export async function createPost(
  input: CreatePostInput,
  viewerId: string | null | undefined,
  opts?: UploadOptions,
): Promise<Post> {
  const raw = input.image
    ? await http.post<RawPost>('/posts', buildPostFormData(input.content, input.image), multipartConfig(opts))
    : await http.post<RawPost>('/posts', { content: input.content });
  return mapPost(raw, viewerId);
}

export interface UpdatePostInput {
  content?: string;
  /** PickedImage = replace, null = remove, undefined = keep. */
  image?: PickedImage | null;
}

/** PATCH /posts/:id */
export async function updatePost(
  postId: string,
  input: UpdatePostInput,
  viewerId: string | null | undefined,
  opts?: UploadOptions,
): Promise<Post> {
  const url = `/posts/${encodeURIComponent(postId)}`;
  let raw: RawPost;
  if (input.image) {
    raw = await http.patch<RawPost>(url, buildPostFormData(input.content, input.image), multipartConfig(opts));
  } else {
    const body: { content?: string; image?: string } = {};
    if (input.content !== undefined) body.content = input.content;
    if (input.image === null) body.image = '';
    raw = await http.patch<RawPost>(url, body);
  }
  return mapPost(raw, viewerId);
}

/** DELETE /posts/:id (author only). */
export async function deletePost(postId: string): Promise<void> {
  await http.delete(`/posts/${encodeURIComponent(postId)}`);
}

/** POST /posts/:id/like — toggles; returns the updated post. */
export async function toggleLike(postId: string, viewerId: string | null | undefined): Promise<Post> {
  return mapPost(await http.post<RawPost>(`/posts/${encodeURIComponent(postId)}/like`), viewerId);
}

export async function bookmarkPost(postId: string): Promise<void> {
  await http.post(`/posts/${encodeURIComponent(postId)}/bookmark`);
}

export async function unbookmarkPost(postId: string): Promise<void> {
  await http.delete(`/posts/${encodeURIComponent(postId)}/bookmark`);
}

/** POST /posts/:id/comments — returns the whole updated post. */
export async function addComment(
  postId: string,
  input: { content: string; parentId?: string },
  viewerId: string | null | undefined,
): Promise<Post> {
  const body: { content: string; parentId?: string } = { content: input.content };
  if (input.parentId) body.parentId = input.parentId;
  return mapPost(await http.post<RawPost>(`/posts/${encodeURIComponent(postId)}/comments`, body), viewerId);
}

/** DELETE /posts/:id/comments/:commentId — also deletes the comment's replies. */
export async function deleteComment(postId: string, commentId: string): Promise<void> {
  await http.delete(`/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`);
}

/** POST /posts/:id/comments/:commentId/like — toggles. */
export async function toggleCommentLike(
  postId: string,
  commentId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const res = await http.post<{ liked: boolean; likes: number | unknown[] }>(
    `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/like`,
  );
  const likeCount = Array.isArray(res?.likes) ? res.likes.length : Number(res?.likes ?? 0);
  return { liked: !!res?.liked, likeCount };
}
