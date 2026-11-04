const { io: connect } = require('socket.io-client');
const { server } = require('../src/app');
const Post = require('../src/shared/models/Post');
const { api, registerUser, createPost } = require('./helpers');

const block = (by, target) => api().post(`/api/v2/users/${target.id}/block`).set('Authorization', by.auth);

describe('blocking', () => {
  let alice;
  let bob;

  beforeAll(() => Post.init());

  beforeEach(async () => {
    alice = await registerUser({ username: 'alice' });
    bob = await registerUser({ username: 'bobby' });
  });

  it('blocks, lists and unblocks', async () => {
    expect((await block(alice, bob)).status).toBe(200);

    const list = await api().get('/api/v2/users/blocked').set('Authorization', alice.auth);
    expect(list.body.data.map((u) => u.username)).toEqual(['bobby']);

    await api().delete(`/api/v2/users/${bob.id}/block`).set('Authorization', alice.auth);
    const after = await api().get('/api/v2/users/blocked').set('Authorization', alice.auth);
    expect(after.body.count).toBe(0);
  });

  it('does not allow blocking yourself', async () => {
    expect((await block(alice, alice)).status).toBe(400);
  });

  it('removes follows and prevents following again', async () => {
    await api().post(`/api/v2/users/${bob.id}/follow`).set('Authorization', alice.auth);
    await api().post(`/api/v2/users/${alice.id}/follow`).set('Authorization', bob.auth);
    await block(alice, bob);

    const followers = await api().get(`/api/v2/users/${alice.id}/followers`).set('Authorization', alice.auth);
    expect(followers.body.count).toBe(0);

    const refollow = await api().post(`/api/v2/users/${alice.id}/follow`).set('Authorization', bob.auth);
    expect(refollow.status).toBe(403);
  });

  it('hides profiles and posts in both directions', async () => {
    const post = await createPost(alice, 'secret #hidden post');
    await block(alice, bob);

    expect((await api().get(`/api/v2/users/${alice.id}`).set('Authorization', bob.auth)).status).toBe(404);
    expect((await api().get(`/api/v2/posts/${post._id}`).set('Authorization', bob.auth)).status).toBe(404);
    expect((await api().get(`/api/v2/posts/user/${alice.id}`).set('Authorization', bob.auth)).status).toBe(404);

    const all = await api().get('/api/v2/posts').set('Authorization', bob.auth);
    expect(all.body.data).toEqual([]);

    const tagged = await api().get('/api/v2/posts/hashtag/hidden').set('Authorization', bob.auth);
    expect(tagged.body.data).toEqual([]);

    const found = await api().get('/api/v2/search').query({ q: 'ali' }).set('Authorization', bob.auth);
    expect(found.body.data.users).toEqual([]);
  });

  it('blocks likes and comments, and drops notifications', async () => {
    const post = await createPost(alice);
    await block(alice, bob);

    expect((await api().post(`/api/v2/posts/${post._id}/like`).set('Authorization', bob.auth)).status).toBe(403);
    const comment = await api()
      .post(`/api/v2/posts/${post._id}/comments`)
      .set('Authorization', bob.auth)
      .send({ content: 'hi @alice' });
    expect(comment.status).toBe(403);

    // a mention from a blocked user in someone else's post does not notify
    await createPost(bob, 'hey @alice');
    const notifications = await api().get('/api/v2/notifications').set('Authorization', alice.auth);
    expect(notifications.body.pagination.total).toBe(0);
  });

  it('refuses chat messages between blocked users', (done) => {
    block(bob, alice).then(() => {
      server.listen(0, () => {
        const socket = connect(`http://localhost:${server.address().port}`, {
          auth: { token: alice.token },
          transports: ['websocket'],
        });
        socket.on('connect', () => socket.emit('chat:message', { receiverId: bob.id, content: 'hello?' }));
        socket.on('chat:error', (err) => {
          expect(err.message).toBe('You cannot message this user');
          socket.close();
          // let presence writes finish before the DB is cleaned
          setTimeout(() => server.close(done), 200);
        });
      });
    });
  });
});
