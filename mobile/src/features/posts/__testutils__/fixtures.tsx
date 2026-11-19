/// <reference types="jest" />
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import * as React from 'react';

import { mapPost } from '@/api/posts';
import type { RawPost } from '@/api/posts';
import type { Post } from '@/lib/posts';

import type { PostListData } from '../cache';

export const ME = 'u-me';

let n = 0;
export function rawPost(overrides: Partial<RawPost> = {}): RawPost {
  n += 1;
  return {
    _id: `p${n}`,
    content: `post ${n}`,
    image: '',
    thumbnail: '',
    author: { _id: 'u-other', username: 'other', avatar: '' },
    likes: [],
    comments: [],
    hashtags: [],
    mentions: [],
    bookmarked: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export const post = (overrides: Partial<RawPost> = {}): Post => mapPost(rawPost(overrides), ME);

export function newQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
}

export function wrapperFor(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

export function seedList(qc: QueryClient, key: QueryKey, posts: Post[]): void {
  qc.setQueryData<PostListData>(key, { pages: [{ posts, next: null }], pageParams: [{}] });
}

export function listPosts(qc: QueryClient, key: QueryKey): Post[] | undefined {
  return qc.getQueryData<PostListData>(key)?.pages.flatMap((p) => p.posts);
}

/** Minimal React Native–style FormData (records parts) so tests can inspect multipart bodies. */
export class RNFormData {
  _parts: [string, unknown][] = [];
  append(key: string, value: unknown) {
    this._parts.push([key, value]);
  }
  getParts() {
    return this._parts.map(([fieldName, value]) => ({ fieldName, value }));
  }
  get [Symbol.toStringTag]() {
    return 'FormData';
  }
}
