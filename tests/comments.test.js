const { api, registerUser, createPost } = require('./helpers');

const comment = (user, postId, body) =>
  api().post(`/api/v2/posts/${postId}/comments`).set('Authorization', user.auth).send(body);

describe('comment threads', () => {
  let alice;
  let bob;
  let post;

  beforeEach(async () => {
    alice = await registerUser();
    bob = await registerUser();
    post = await createPost(alice, 'Thread me');
  });

  it('replies to a comment and notifies its author', async () => {
    const top = (await comment(alice, post._id, { content: 'top level' })).body.data.comments[0];
    const res = await comment(bob, post._id, { content: 'a reply', parentId: top._id });

    expect(res.status).toBe(201);
    expect(res.body.data.comments[1].parentId).toBe(top._id);

    const notifications = (await api().get('/api/v2/notifications').set('Authorization', alice.auth)).body.data;
    expect(notifications.map((n) => n.content)).toContain(`${bob.username} replied: a reply`);
  });

  it('attaches replies to replies to the top-level comment', async () => {
    const top = (await comment(alice, post._id, { content: 'top' })).body.data.comments[0];
    const reply = (await comment(bob, post._id, { content: 'reply', parentId: top._id })).body.data.comments[1];
    const nested = (await comment(alice, post._id, { content: 'nested', parentId: reply._id })).body.data.comments[2];

    expect(nested.parentId).toBe(top._id);
  });

  it('rejects unknown or malformed parent ids', async () => {
    expect((await comment(bob, post._id, { content: 'x', parentId: '000000000000000000000000' })).status).toBe(404);
    expect((await comment(bob, post._id, { content: 'x', parentId: 'nope' })).status).toBe(400);
  });

  it('deletes replies with their parent', async () => {
    const top = (await comment(bob, post._id, { content: 'top' })).body.data.comments[0];
    await comment(alice, post._id, { content: 'reply', parentId: top._id });
    await comment(alice, post._id, { content: 'other top-level' });

    await api().delete(`/api/v2/posts/${post._id}/comments/${top._id}`).set('Authorization', bob.auth);

    const after = await api().get(`/api/v2/posts/${post._id}`).set('Authorization', bob.auth);
    expect(after.body.data.comments.map((c) => c.content)).toEqual(['other top-level']);
  });

  it('toggles comment likes', async () => {
    const top = (await comment(alice, post._id, { content: 'like me' })).body.data.comments[0];
    const like = () =>
      api().post(`/api/v2/posts/${post._id}/comments/${top._id}/like`).set('Authorization', bob.auth);

    expect((await like()).body.data).toEqual({ liked: true, likes: 1 });
    expect((await like()).body.data).toEqual({ liked: false, likes: 0 });
  });
});
