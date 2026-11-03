const { api, registerUser, createPost } = require('./helpers');

describe('users and follows', () => {
  let alice;
  let bob;

  beforeEach(async () => {
    alice = await registerUser();
    bob = await registerUser();
  });

  it('returns the current profile without secrets', async () => {
    const res = await api().get('/api/v2/users/profile').set('Authorization', alice.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(alice.username);
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();
  });

  it('updates the profile', async () => {
    const res = await api()
      .patch('/api/v2/users/profile')
      .set('Authorization', alice.auth)
      .send({ username: 'alice_new' });

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('alice_new');
  });

  it('follows and unfollows', async () => {
    const follow = await api().post(`/api/v2/users/${bob.id}/follow`).set('Authorization', alice.auth);
    expect(follow.status).toBe(200);

    const followers = await api().get(`/api/v2/users/${bob.id}/followers`).set('Authorization', alice.auth);
    expect(followers.body.count).toBe(1);
    expect(followers.body.data[0].username).toBe(alice.username);

    const following = await api().get(`/api/v2/users/${alice.id}/following`).set('Authorization', alice.auth);
    expect(following.body.count).toBe(1);

    await api().delete(`/api/v2/users/${bob.id}/follow`).set('Authorization', alice.auth);
    const after = await api().get(`/api/v2/users/${bob.id}/followers`).set('Authorization', alice.auth);
    expect(after.body.count).toBe(0);
  });

  it('does not allow following yourself', async () => {
    const res = await api().post(`/api/v2/users/${alice.id}/follow`).set('Authorization', alice.auth);
    expect(res.status).toBe(400);
  });

  it('builds the feed from followed users and yourself', async () => {
    const charlie = await registerUser();
    await createPost(alice, 'alice post');
    await createPost(bob, 'bob post');
    await createPost(charlie, 'charlie post');

    await api().post(`/api/v2/users/${bob.id}/follow`).set('Authorization', alice.auth);

    const res = await api().get('/api/v2/posts/feed').set('Authorization', alice.auth);
    const contents = res.body.data.map((p) => p.content).sort();
    expect(contents).toEqual(['alice post', 'bob post']);
  });

  it("lists a single user's posts", async () => {
    await createPost(bob, 'one');
    await createPost(bob, 'two');
    await createPost(alice, 'other');

    const res = await api().get(`/api/v2/posts/user/${bob.id}`).set('Authorization', alice.auth);
    expect(res.body.pagination.total).toBe(2);
  });
});
