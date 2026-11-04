const { api, registerUser, createPost } = require('./helpers');

const saved = async (user) => (await api().get('/api/v2/posts/bookmarks').set('Authorization', user.auth)).body;

describe('bookmarks', () => {
  let alice;
  let bob;

  beforeEach(async () => {
    alice = await registerUser();
    bob = await registerUser();
  });

  it('saves posts and lists the most recent save first', async () => {
    const first = await createPost(bob, 'first');
    const second = await createPost(bob, 'second');

    await api().post(`/api/v2/posts/${second._id}/bookmark`).set('Authorization', alice.auth);
    await api().post(`/api/v2/posts/${first._id}/bookmark`).set('Authorization', alice.auth);
    // saving twice keeps a single entry
    await api().post(`/api/v2/posts/${first._id}/bookmark`).set('Authorization', alice.auth);

    const body = await saved(alice);
    expect(body.data.map((p) => p.content)).toEqual(['first', 'second']);
    expect(body.pagination.total).toBe(2);
  });

  it('keeps bookmarks private', async () => {
    const post = await createPost(bob);
    await api().post(`/api/v2/posts/${post._id}/bookmark`).set('Authorization', alice.auth);

    const profile = await api().get(`/api/v2/users/${alice.id}`).set('Authorization', bob.auth);
    expect(profile.body.data.bookmarks).toBeUndefined();
    expect((await saved(bob)).data).toEqual([]);
  });

  it('removes a bookmark', async () => {
    const post = await createPost(bob);
    await api().post(`/api/v2/posts/${post._id}/bookmark`).set('Authorization', alice.auth);
    await api().delete(`/api/v2/posts/${post._id}/bookmark`).set('Authorization', alice.auth);

    expect((await saved(alice)).data).toEqual([]);
  });

  it('drops bookmarks of deleted posts', async () => {
    const post = await createPost(bob);
    await api().post(`/api/v2/posts/${post._id}/bookmark`).set('Authorization', alice.auth);
    await api().delete(`/api/v2/posts/${post._id}`).set('Authorization', bob.auth);

    expect((await saved(alice)).pagination.total).toBe(0);
  });

  it('returns 404 when saving a missing post', async () => {
    const res = await api().post('/api/v2/posts/000000000000000000000000/bookmark').set('Authorization', alice.auth);
    expect(res.status).toBe(404);
  });
});
