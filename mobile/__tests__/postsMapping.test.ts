/// <reference types="jest" />
import { mapPost, nextPageParam, resolveMediaUrl } from '@/api/posts';
import { API_URL } from '@/lib/config';

import { ME, rawPost } from '@/features/posts/__testutils__/fixtures';

describe('resolveMediaUrl', () => {
  it('resolves relative paths against API_URL, keeps absolute URLs, maps empty to null', () => {
    expect(resolveMediaUrl('/uploads/x.jpg')).toBe(`${API_URL}/uploads/x.jpg`);
    expect(resolveMediaUrl('uploads/x.jpg')).toBe(`${API_URL}/uploads/x.jpg`);
    expect(resolveMediaUrl('https://res.cloudinary.com/a/b.jpg')).toBe('https://res.cloudinary.com/a/b.jpg');
    expect(resolveMediaUrl('')).toBeNull();
    expect(resolveMediaUrl('  ')).toBeNull();
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl(undefined)).toBeNull();
  });
});

describe('mapPost', () => {
  it('maps ids, media URLs, counts and viewer state', () => {
    const p = mapPost(
      rawPost({
        _id: 'p1',
        image: '/uploads/big.jpg',
        thumbnail: 'https://res.cloudinary.com/t.jpg',
        author: { _id: ME, username: 'me', avatar: '/uploads/me.png' },
        likes: ['u-a', ME],
        comments: [
          {
            _id: 'c1',
            author: { _id: 'u-a', username: 'a', avatar: '' },
            content: 'hi',
            parentId: null,
            likes: [ME],
            createdAt: '2026-01-02T00:00:00.000Z',
          },
          {
            _id: 'c2',
            author: { _id: ME, username: 'me', avatar: '/uploads/me.png' },
            content: 'reply',
            parentId: 'c1',
            likes: [],
            createdAt: '2026-01-03T00:00:00.000Z',
          },
        ],
        hashtags: ['js'],
        bookmarked: true,
      }),
      ME,
    );
    expect(p).toMatchObject({
      id: 'p1',
      image: `${API_URL}/uploads/big.jpg`,
      thumbnail: 'https://res.cloudinary.com/t.jpg',
      author: { id: ME, username: 'me', avatar: `${API_URL}/uploads/me.png` },
      likeCount: 2,
      likedByMe: true,
      bookmarked: true,
      commentCount: 2,
      hashtags: ['js'],
      isMine: true,
    });
    expect(p.comments[0]).toEqual({
      id: 'c1',
      author: { id: 'u-a', username: 'a', avatar: null },
      content: 'hi',
      parentId: null,
      likeCount: 1,
      likedByMe: true,
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    expect(p.comments[1]).toMatchObject({ parentId: 'c1', likedByMe: false, likeCount: 0 });
  });

  it('empty image/thumbnail → null; not liked / not mine for another viewer', () => {
    const p = mapPost(rawPost({ likes: ['u-a'] }), ME);
    expect(p.image).toBeNull();
    expect(p.thumbnail).toBeNull();
    expect(p.likedByMe).toBe(false);
    expect(p.likeCount).toBe(1);
    expect(p.isMine).toBe(false);
  });

  it('handles older payloads: missing bookmarked → false, mentions as ids', () => {
    const raw = rawPost({ mentions: ['u-a', 'u-b'] });
    delete raw.bookmarked;
    const p = mapPost(raw, ME);
    expect(p.bookmarked).toBe(false);
    expect(p.mentions).toEqual([
      { id: 'u-a', username: '' },
      { id: 'u-b', username: '' },
    ]);
  });

  it('trending items: no comments array → comments [], commentCount from the payload; extra fields ignored', () => {
    const raw = { ...rawPost({ commentCount: 7 }), __v: 0, engagement: 12, score: 3.5 };
    delete raw.comments;
    const p = mapPost(raw, ME);
    expect(p.comments).toEqual([]);
    expect(p.commentCount).toBe(7);
    expect(p).not.toHaveProperty('score');
    expect(p).not.toHaveProperty('__v');
  });

  it('handles populated mentions', () => {
    const p = mapPost(rawPost({ mentions: [{ _id: 'u-a', username: 'alice' }] }), ME);
    expect(p.mentions).toEqual([{ id: 'u-a', username: 'alice' }]);
  });

  it('no viewer → nothing is liked or mine', () => {
    const p = mapPost(rawPost({ likes: [ME], author: { _id: ME, username: 'me' } }), null);
    expect(p.likedByMe).toBe(false);
    expect(p.isMine).toBe(false);
  });
});

describe('nextPageParam', () => {
  it('prefers cursors, falls back to page numbers, stops at the end', () => {
    expect(nextPageParam({ limit: 20, nextCursor: 'abc' }, 20)).toEqual({ cursor: 'abc' });
    expect(nextPageParam({ limit: 20, nextCursor: null }, 20)).toBeNull();
    expect(nextPageParam({ page: 1, pages: 3, total: 50 }, 20)).toEqual({ page: 2 });
    expect(nextPageParam({ page: 3, pages: 3, total: 50 }, 10)).toBeNull();
    expect(nextPageParam(undefined, 10)).toBeNull();
    expect(nextPageParam({ nextCursor: 'abc' }, 0)).toBeNull();
  });
});
