const Post = require('../src/shared/models/Post');
const { api, registerUser, createPost } = require('./helpers');

const get = (user, path, query = {}) => api().get(`/api/v2${path}`).query(query).set('Authorization', user.auth);
const bookmark = (user, post) => api().post(`/api/v2/posts/${post._id}/bookmark`).set('Authorization', user.auth);
const flags = (posts) => Object.fromEntries(posts.map((p) => [p.content, p.bookmarked]));

describe('per-viewer post fields', () => {
  let alice;
  let bob;
  let saved;
  let other;

  beforeEach(async () => {
    alice = await registerUser();
    bob = await registerUser();
    saved = await createPost(alice, 'saved #mobile');
    other = await createPost(alice, 'other #mobile');
    await bookmark(bob, saved);
    // bob follows alice so her posts are in his feed
    await api().post(`/api/v2/users/${alice.id}/follow`).set('Authorization', bob.auth);
  });

  it('marks bookmarked posts on every list route', async () => {
    for (const path of ['/posts', '/posts/feed', `/posts/user/${alice.id}`, '/posts/hashtag/mobile']) {
      const res = await get(bob, path);
      expect(res.status).toBe(200);
      expect(flags(res.body.data)).toEqual({ 'saved #mobile': true, 'other #mobile': false });

      // a viewer who saved nothing sees false everywhere
      const mine = await get(alice, path);
      expect(mine.body.data.every((p) => p.bookmarked === false)).toBe(true);
    }
  });

  it('marks trending posts and bookmarks list', async () => {
    await api().post(`/api/v2/posts/${saved._id}/like`).set('Authorization', alice.auth);
    await api().post(`/api/v2/posts/${other._id}/like`).set('Authorization', alice.auth);

    const trending = await get(bob, '/posts/trending');
    expect(trending.status).toBe(200);
    expect(flags(trending.body.data)).toEqual({ 'saved #mobile': true, 'other #mobile': false });
    expect(trending.body.data.every((p) => p.bookmarked === false)).toBe(false);
    expect((await get(alice, '/posts/trending')).body.data.every((p) => p.bookmarked === false)).toBe(true);

    const bookmarks = await get(bob, '/posts/bookmarks');
    expect(bookmarks.body.data).toHaveLength(1);
    expect(bookmarks.body.data[0]).toMatchObject({ content: 'saved #mobile', bookmarked: true });
    expect(bookmarks.body.data[0].author.username).toBe(alice.username);
  });

  it('marks single post and mutation responses', async () => {
    expect((await get(bob, `/posts/${saved._id}`)).body.data.bookmarked).toBe(true);
    expect((await get(bob, `/posts/${other._id}`)).body.data.bookmarked).toBe(false);
    expect((await get(alice, `/posts/${saved._id}`)).body.data.bookmarked).toBe(false);

    const liked = await api().post(`/api/v2/posts/${saved._id}/like`).set('Authorization', bob.auth);
    expect(liked.body.data.bookmarked).toBe(true);

    const commented = await api()
      .post(`/api/v2/posts/${saved._id}/comments`)
      .set('Authorization', bob.auth)
      .send({ content: 'nice' });
    expect(commented.status).toBe(201);
    expect(commented.body.data.bookmarked).toBe(true);

    // alice liking the post bob saved still sees false
    const aliceLike = await api().post(`/api/v2/posts/${saved._id}/like`).set('Authorization', alice.auth);
    expect(aliceLike.body.data.bookmarked).toBe(false);
    // like response now has populated comment authors too
    expect(aliceLike.body.data.comments[0].author).toMatchObject({ _id: bob.id, username: bob.username });

    await bookmark(alice, other);
    const updated = await api()
      .patch(`/api/v2/posts/${other._id}`)
      .set('Authorization', alice.auth)
      .send({ content: 'edited' });
    expect(updated.body.data).toMatchObject({ content: 'edited', bookmarked: true });

    const created = await api().post('/api/v2/posts').set('Authorization', alice.auth).send({ content: 'new' });
    expect(created.status).toBe(201);
    expect(created.body.data.bookmarked).toBe(false);
  });

  it('keeps the document shape when serialising', async () => {
    await api().post(`/api/v2/posts/${saved._id}/comments`).set('Authorization', bob.auth).send({ content: 'hi' });
    const { data } = (await get(bob, `/posts/${saved._id}`)).body;

    expect(data).toMatchObject({
      _id: saved._id,
      content: 'saved #mobile',
      author: { _id: alice.id, username: alice.username, avatar: '' },
      hashtags: ['mobile'],
      likes: [],
      bookmarked: true,
    });
    expect(data.createdAt).toEqual(expect.any(String));
    expect(data.updatedAt).toEqual(expect.any(String));
    expect(data.comments[0]).toMatchObject({ content: 'hi', author: { _id: bob.id, username: bob.username } });
    expect(data.comments[0]._id).toEqual(expect.any(String));
    expect(data.author.email).toBeUndefined();
  });
});

describe('commentCount', () => {
  it('is set on trending items and matches comments.length elsewhere', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const post = await createPost(alice, 'talk about it');
    const comment = (content) =>
      api().post(`/api/v2/posts/${post._id}/comments`).set('Authorization', bob.auth).send({ content });
    await comment('one');
    await comment('two');
    await comment('three');

    const trending = (await get(bob, '/posts/trending')).body.data;
    expect(trending[0]).toMatchObject({ _id: post._id, commentCount: 3 });
    expect(trending[0].comments).toBeUndefined();

    const item = (await get(alice, '/posts')).body.data[0];
    expect(item.commentCount).toBe(item.comments.length);
    expect(item.commentCount).toBe(3);
    expect((await get(alice, `/posts/${post._id}`)).body.data.commentCount).toBe(3);
  });
});

describe('mentions', () => {
  it('populates mentioned users with username on every post payload', async () => {
    const alice = await registerUser();
    const carol = await registerUser({ username: 'carol_m' });
    const post = await createPost(alice, 'hey @carol_m #tagged');
    const expected = [{ _id: carol.id, username: 'carol_m' }];

    expect(post.mentions).toEqual(expected);
    expect((await get(alice, `/posts/${post._id}`)).body.data.mentions).toEqual(expected);
    expect((await get(alice, '/posts')).body.data[0].mentions).toEqual(expected);
    expect((await get(alice, '/posts/hashtag/tagged')).body.data[0].mentions).toEqual(expected);

    const liked = await api().post(`/api/v2/posts/${post._id}/like`).set('Authorization', carol.auth);
    expect(liked.body.data.mentions).toEqual(expected);
    expect((await get(alice, '/posts/trending')).body.data[0].mentions).toEqual(expected);
  });
});

describe('cursor pagination on user and hashtag posts', () => {
  let alice;
  let bob;

  beforeEach(async () => {
    alice = await registerUser();
    bob = await registerUser();
    const at = Date.parse('2026-01-01T00:00:00Z');
    await Post.insertMany([
      ...Array.from({ length: 5 }, (_, i) => ({
        content: `alice ${i} #walk`,
        hashtags: ['walk'],
        author: alice.id,
        createdAt: new Date(at + i * 1000),
      })),
      { content: 'bob #walk', hashtags: ['walk'], author: bob.id, createdAt: new Date(at + 10000) },
      { content: 'alice untagged', author: alice.id, createdAt: new Date(at - 1000) },
    ]);
  });

  const walk = async (path) => {
    const first = await get(bob, path, { limit: 3 });
    expect(first.status).toBe(200);
    expect(first.body.pagination.nextCursor).toEqual(expect.any(String));

    const second = await get(bob, path, { limit: 3, cursor: first.body.pagination.nextCursor });
    expect(second.status).toBe(200);
    expect(second.body.pagination).toEqual({ limit: 3, nextCursor: null });

    const firstIds = first.body.data.map((p) => p._id);
    expect(second.body.data.some((p) => firstIds.includes(p._id))).toBe(false);
    return [...first.body.data, ...second.body.data].map((p) => p.content);
  };

  it('pages a user\'s posts with a cursor', async () => {
    expect(await walk(`/posts/user/${alice.id}`)).toEqual([
      'alice 4 #walk',
      'alice 3 #walk',
      'alice 2 #walk',
      'alice 1 #walk',
      'alice 0 #walk',
      'alice untagged',
    ]);
  });

  it('pages hashtag posts with a cursor', async () => {
    expect(await walk('/posts/hashtag/%23WALK')).toEqual([
      'bob #walk',
      'alice 4 #walk',
      'alice 3 #walk',
      'alice 2 #walk',
      'alice 1 #walk',
      'alice 0 #walk',
    ]);
  });

  it('keeps page numbers and adds nextCursor', async () => {
    const res = await get(bob, `/posts/user/${alice.id}`, { page: 2, limit: 4 });
    expect(res.body.pagination).toEqual({ page: 2, limit: 4, total: 6, pages: 2, nextCursor: null });
    expect(res.body.data).toHaveLength(2);

    const first = await get(bob, '/posts/hashtag/walk', { page: 1, limit: 4 });
    expect(first.body.pagination).toMatchObject({ page: 1, total: 6, pages: 2 });
    expect(first.body.pagination.nextCursor).toEqual(expect.any(String));
  });

  it('still hides blocked users', async () => {
    await api().post(`/api/v2/users/${alice.id}/block`).set('Authorization', bob.auth);
    expect((await get(bob, `/posts/user/${alice.id}`, { limit: 3 })).status).toBe(404);
    expect((await get(bob, '/posts/hashtag/walk')).body.data.map((p) => p.content)).toEqual(['bob #walk']);
  });
});
