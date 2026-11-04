const mongoose = require('mongoose');
const Post = require('../src/shared/models/Post');
const { api, registerUser, createPost } = require('./helpers');

const like = (user, post) => api().post(`/api/v2/posts/${post._id}/like`).set('Authorization', user.auth);
const HOUR = 60 * 60 * 1000;
const oid = (id) => new mongoose.Types.ObjectId(id);

describe('trending', () => {
  let alice;
  let bob;
  let carol;

  beforeEach(async () => {
    [alice, bob, carol] = await Promise.all([registerUser(), registerUser(), registerUser()]);
  });

  it('ranks fresh engagement above older popularity and skips posts without engagement', async () => {
    const fresh = await createPost(alice, 'fresh');
    const old = await createPost(alice, 'old');
    await createPost(alice, 'ignored');

    await like(bob, fresh);
    await like(bob, old);
    await like(carol, old);
    // two likes, but 30 hours old (raw driver: Mongoose treats createdAt as immutable)
    await Post.collection.updateOne({ _id: oid(old._id) }, { $set: { createdAt: new Date(Date.now() - 30 * HOUR) } });

    const res = await api().get('/api/v2/posts/trending').set('Authorization', bob.auth);
    expect(res.body.data.map((p) => p.content)).toEqual(['fresh', 'old']);
    expect(res.body.data[0].author.username).toBe(alice.username);
    expect(res.body.data[0].score).toBeGreaterThan(res.body.data[1].score);
  });

  it('respects the time window', async () => {
    const post = await createPost(alice, 'last week');
    await like(bob, post);
    await Post.collection.updateOne({ _id: oid(post._id) }, { $set: { createdAt: new Date(Date.now() - 100 * HOUR) } });

    const res = await api().get('/api/v2/posts/trending').query({ hours: 24 }).set('Authorization', bob.auth);
    expect(res.body.data).toEqual([]);
  });

  it('ranks hashtags by distinct authors', async () => {
    await createPost(alice, '#spam #spam2');
    await createPost(alice, '#spam again');
    await createPost(alice, '#spam more');
    await createPost(alice, '#popular');
    await createPost(bob, '#popular');
    await createPost(carol, '#popular');

    const res = await api().get('/api/v2/hashtags/trending').set('Authorization', bob.auth);
    expect(res.body.data.slice(0, 2)).toEqual([
      { tag: 'popular', posts: 3, authors: 3 },
      { tag: 'spam', posts: 3, authors: 1 },
    ]);
  });
});
