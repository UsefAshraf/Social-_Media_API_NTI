/// <reference types="jest" />
import { mapProfile, mapUserSummary } from '@/api/users';
import { API_URL } from '@/lib/config';

const ME = 'u-me';

describe('mapProfile', () => {
  it('maps the full contract shape and resolves a relative avatar', () => {
    const p = mapProfile(
      {
        _id: 'u1',
        username: 'alice',
        avatar: '/uploads/a.jpg',
        bio: 'hi',
        followersCount: 3,
        followingCount: 2,
        postsCount: 7,
        isMe: false,
        isFollowing: true,
        followsYou: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        followers: [ME, 'x', 'y'],
        following: [ME, 'z'],
      },
      ME,
    );
    expect(p).toEqual({
      id: 'u1',
      username: 'alice',
      avatar: `${API_URL}/uploads/a.jpg`,
      bio: 'hi',
      followersCount: 3,
      followingCount: 2,
      postsCount: 7,
      isMe: false,
      isFollowing: true,
      followsYou: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(p).not.toHaveProperty('email');
  });

  it('keeps absolute avatars, maps "" to null', () => {
    expect(mapProfile({ _id: 'u1', avatar: 'https://cdn.x/a.png' }, ME).avatar).toBe('https://cdn.x/a.png');
    expect(mapProfile({ _id: 'u1', avatar: '' }, ME).avatar).toBeNull();
  });

  it('includes own-only fields on your own profile only', () => {
    const mine = mapProfile({ _id: ME, isMe: true, email: 'me@x.io', emailVerified: false, role: 'user' }, ME);
    expect(mine).toMatchObject({ isMe: true, email: 'me@x.io', emailVerified: false, isFollowing: false });
    expect(mine).not.toHaveProperty('role');
    const theirs = mapProfile({ _id: 'u1', isMe: false, email: 'leak@x.io', emailVerified: true }, ME);
    expect(theirs).not.toHaveProperty('email');
    expect(theirs).not.toHaveProperty('emailVerified');
  });

  it('falls back for older payloads: counts from arrays, bio "", isMe / isFollowing / followsYou derived', () => {
    const p = mapProfile(
      { _id: 'u1', username: 'old', followers: [{ _id: ME }, 'a'], following: ['b', ME, 'c'], createdAt: 'x' },
      ME,
    );
    expect(p).toMatchObject({
      bio: '',
      followersCount: 2,
      followingCount: 3,
      postsCount: 0,
      isMe: false,
      isFollowing: true,
      followsYou: true,
      avatar: null,
    });
    const me = mapProfile({ _id: ME, email: 'me@x.io', followers: [] }, ME);
    expect(me).toMatchObject({ isMe: true, isFollowing: false, followsYou: false, email: 'me@x.io', emailVerified: false });
  });
});

describe('mapUserSummary', () => {
  it('maps a row, resolving the avatar', () => {
    expect(mapUserSummary({ _id: 'u1', username: 'a', avatar: '/uploads/x.jpg', bio: 'b', isFollowing: true, isMe: false }, ME)).toEqual({
      id: 'u1',
      username: 'a',
      avatar: `${API_URL}/uploads/x.jpg`,
      bio: 'b',
      isMe: false,
      isFollowing: true,
    });
  });

  it('falls back for older rows', () => {
    expect(mapUserSummary({ _id: ME, username: 'me', isFollowing: true }, ME)).toEqual({
      id: ME,
      username: 'me',
      avatar: null,
      bio: '',
      isMe: true,
      isFollowing: false,
    });
  });
});
