const Post = require('../src/shared/models/Post');
const { api, registerUser } = require('./helpers');

const feed = (user, query) => api().get('/api/v2/posts/feed').query(query).set('Authorization', user.auth);

describe('cursor pagination', () => {
  let alice;

  beforeEach(async () => {
    alice = await registerUser();
    // same timestamp for several posts to exercise the _id tie-breaker
    const at = new Date('2026-01-01T00:00:00Z');
    await Post.insertMany(
      Array.from({ length: 7 }, (_, i) => ({ content: `post ${i}`, author: alice.id, createdAt: i < 4 ? at : new Date(at.getTime() + i * 1000) }))
    );
  });

  it('walks every post exactly once', async () => {
    const seen = [];
    let cursor;
    let pages = 0;
    do {
      const res = await feed(alice, { limit: 3, ...(cursor && { cursor }) });
      expect(res.status).toBe(200);
      seen.push(...res.body.data.map((p) => p.content));
      cursor = res.body.pagination.nextCursor;
      pages += 1;
    } while (cursor);

    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(7);
    expect(seen.slice(0, 3)).toEqual(['post 6', 'post 5', 'post 4']);
  });

  it('does not repeat posts when new ones arrive between pages', async () => {
    const first = await feed(alice, { limit: 3 });
    await api().post('/api/v2/posts').set('Authorization', alice.auth).send({ content: 'brand new' });

    const second = await feed(alice, { limit: 3, cursor: first.body.pagination.nextCursor });
    const firstIds = first.body.data.map((p) => p._id);
    expect(second.body.data.some((p) => firstIds.includes(p._id))).toBe(false);
    expect(second.body.data.map((p) => p.content)).not.toContain('brand new');
  });

  it('still supports page numbers', async () => {
    const res = await feed(alice, { page: 2, limit: 5 });
    expect(res.body.pagination).toMatchObject({ page: 2, total: 7, pages: 2, nextCursor: null });
    expect(res.body.data).toHaveLength(2);
  });

  it('rejects malformed cursors', async () => {
    expect((await feed(alice, { cursor: 'garbage' })).status).toBe(400);
  });
});
