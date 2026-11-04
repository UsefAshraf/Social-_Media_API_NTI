const User = require('../src/shared/models/User');
const { api, registerUser, createPost } = require('./helpers');

const makeAdmin = async (user) => {
  await User.updateOne({ _id: user.id }, { role: 'admin' });
  return user;
};
const report = (user, body) => api().post('/api/v2/reports').set('Authorization', user.auth).send(body);

describe('reports', () => {
  let alice;
  let bob;

  beforeEach(async () => {
    alice = await registerUser();
    bob = await registerUser();
  });

  it('reports a post once', async () => {
    const post = await createPost(alice);
    const body = { targetType: 'post', targetId: post._id, reason: 'spam' };

    expect((await report(bob, body)).status).toBe(201);
    expect((await report(bob, body)).status).toBe(409);
  });

  it('reports a comment with its post id', async () => {
    const post = await createPost(alice);
    const commented = await api()
      .post(`/api/v2/posts/${post._id}/comments`)
      .set('Authorization', alice.auth)
      .send({ content: 'rude' });
    const commentId = commented.body.data.comments[0]._id;

    expect((await report(bob, { targetType: 'comment', targetId: commentId, reason: 'harassment' })).status).toBe(400);
    expect(
      (await report(bob, { targetType: 'comment', targetId: commentId, postId: post._id, reason: 'harassment' })).status
    ).toBe(201);
  });

  it('rejects reports of missing targets and of yourself', async () => {
    expect((await report(bob, { targetType: 'user', targetId: '000000000000000000000000', reason: 'spam' })).status).toBe(404);
    expect((await report(bob, { targetType: 'user', targetId: bob.id, reason: 'spam' })).status).toBe(400);
  });
});

describe('admin', () => {
  let admin;
  let alice;
  let bob;

  beforeEach(async () => {
    admin = await makeAdmin(await registerUser());
    alice = await registerUser();
    bob = await registerUser();
  });

  it('is only available to admins', async () => {
    expect((await api().get('/api/v2/admin/stats').set('Authorization', alice.auth)).status).toBe(403);
    expect((await api().get('/api/v2/admin/stats').set('Authorization', admin.auth)).status).toBe(200);
  });

  it('reports platform stats', async () => {
    await createPost(alice);
    const res = await api().get('/api/v2/admin/stats').set('Authorization', admin.auth);
    expect(res.body.data).toMatchObject({ users: 3, posts: 1, postsToday: 1, openReports: 0, bannedUsers: 0 });
  });

  it('resolves a report by deleting the post', async () => {
    const post = await createPost(alice);
    const { body } = await report(bob, { targetType: 'post', targetId: post._id, reason: 'hate' });

    const queue = await api().get('/api/v2/admin/reports').set('Authorization', admin.auth);
    expect(queue.body.data.map((r) => r._id)).toEqual([body.data.id]);

    const res = await api()
      .patch(`/api/v2/admin/reports/${body.data.id}`)
      .set('Authorization', admin.auth)
      .send({ status: 'resolved', action: 'delete_content' });
    expect(res.body.data).toMatchObject({ status: 'resolved', action: 'delete_content' });

    expect((await api().get(`/api/v2/posts/${post._id}`).set('Authorization', bob.auth)).status).toBe(404);
    const open = await api().get('/api/v2/admin/reports').set('Authorization', admin.auth);
    expect(open.body.data).toEqual([]);
  });

  it('resolves a report by banning the author, who is then locked out', async () => {
    const post = await createPost(alice);
    const { body } = await report(bob, { targetType: 'post', targetId: post._id, reason: 'spam' });

    await api()
      .patch(`/api/v2/admin/reports/${body.data.id}`)
      .set('Authorization', admin.auth)
      .send({ status: 'resolved', action: 'ban_user' });

    expect((await api().get('/api/v2/users/profile').set('Authorization', alice.auth)).status).toBe(403);
    const login = await api().post('/api/v2/auth/login').send({ email: alice.email, password: alice.password });
    expect(login.status).toBe(403);
    const refresh = await api().post('/api/v2/auth/refresh').send({ refreshToken: alice.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('dismisses a report without touching the content', async () => {
    const post = await createPost(alice);
    const { body } = await report(bob, { targetType: 'post', targetId: post._id, reason: 'other' });

    await api().patch(`/api/v2/admin/reports/${body.data.id}`).set('Authorization', admin.auth).send({ status: 'dismissed' });

    expect((await api().get(`/api/v2/posts/${post._id}`).set('Authorization', bob.auth)).status).toBe(200);
    const again = await api()
      .patch(`/api/v2/admin/reports/${body.data.id}`)
      .set('Authorization', admin.auth)
      .send({ status: 'resolved' });
    expect(again.status).toBe(400);
  });

  it('bans and unbans directly, but never admins', async () => {
    const ban = (target, banned) =>
      api().patch(`/api/v2/admin/users/${target.id}/ban`).set('Authorization', admin.auth).send({ banned });

    expect((await ban(bob, true)).body.data.banned).toBe(true);
    expect((await api().get('/api/v2/posts').set('Authorization', bob.auth)).status).toBe(403);

    await ban(bob, false);
    expect((await api().get('/api/v2/posts').set('Authorization', bob.auth)).status).toBe(200);

    const otherAdmin = await makeAdmin(alice);
    expect((await ban(otherAdmin, true)).status).toBe(400);
    expect((await ban(admin, true)).status).toBe(400);
  });

  it('deletes any post', async () => {
    const post = await createPost(alice);
    const res = await api().delete(`/api/v2/admin/posts/${post._id}`).set('Authorization', admin.auth);
    expect(res.status).toBe(200);
  });
});
