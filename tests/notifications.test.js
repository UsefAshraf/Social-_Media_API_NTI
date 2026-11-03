const { api, registerUser, createPost } = require('./helpers');

const list = (user) => api().get('/api/v2/notifications').set('Authorization', user.auth);

describe('notifications', () => {
  let alice;
  let bob;

  beforeEach(async () => {
    alice = await registerUser();
    bob = await registerUser();
  });

  it('notifies the author about likes, comments and follows', async () => {
    const post = await createPost(alice);

    await api().post(`/api/v2/posts/${post._id}/like`).set('Authorization', bob.auth);
    await api().post(`/api/v2/posts/${post._id}/comments`).set('Authorization', bob.auth).send({ content: 'hi' });
    await api().post(`/api/v2/users/${alice.id}/follow`).set('Authorization', bob.auth);

    const res = await list(alice);
    expect(res.body.unreadCount).toBe(3);
    expect(res.body.data.map((n) => n.type).sort()).toEqual(['comment', 'follow', 'like']);
  });

  it('skips self actions, unlikes and repeated follows', async () => {
    const post = await createPost(alice);

    await api().post(`/api/v2/posts/${post._id}/like`).set('Authorization', alice.auth);
    await api().post(`/api/v2/posts/${post._id}/like`).set('Authorization', bob.auth);
    await api().post(`/api/v2/posts/${post._id}/like`).set('Authorization', bob.auth);
    await api().post(`/api/v2/users/${alice.id}/follow`).set('Authorization', bob.auth);
    await api().post(`/api/v2/users/${alice.id}/follow`).set('Authorization', bob.auth);

    const res = await list(alice);
    expect(res.body.pagination.total).toBe(2);
  });

  it("does not let users touch other people's notifications", async () => {
    await api().post(`/api/v2/users/${alice.id}/follow`).set('Authorization', bob.auth);
    const [notification] = (await list(alice)).body.data;

    const read = await api().patch(`/api/v2/notifications/${notification._id}/read`).set('Authorization', bob.auth);
    expect(read.status).toBe(404);

    const del = await api().delete(`/api/v2/notifications/${notification._id}`).set('Authorization', bob.auth);
    expect(del.status).toBe(404);
  });

  it('marks one or all notifications as read', async () => {
    const post = await createPost(alice);
    await api().post(`/api/v2/posts/${post._id}/like`).set('Authorization', bob.auth);
    await api().post(`/api/v2/users/${alice.id}/follow`).set('Authorization', bob.auth);
    const [first] = (await list(alice)).body.data;

    const one = await api().patch(`/api/v2/notifications/${first._id}/read`).set('Authorization', alice.auth);
    expect(one.body.data.read).toBe(true);
    expect((await list(alice)).body.unreadCount).toBe(1);

    await api().patch('/api/v2/notifications/read-all').set('Authorization', alice.auth);
    expect((await list(alice)).body.unreadCount).toBe(0);
  });
});
