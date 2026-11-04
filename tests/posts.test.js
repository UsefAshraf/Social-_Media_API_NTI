const path = require('path');
const fs = require('fs');
const { api, registerUser, createPost } = require('./helpers');
const { uploadDir } = require('../src/shared/config/multerConfig');

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

describe('posts', () => {
  let alice;
  let bob;

  beforeEach(async () => {
    alice = await registerUser();
    bob = await registerUser();
  });

  it('creates and fetches a post', async () => {
    const post = await createPost(alice, 'First post');

    const res = await api().get(`/api/v2/posts/${post._id}`).set('Authorization', bob.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('First post');
    expect(res.body.data.author.username).toBe(alice.username);
  });

  it('requires content', async () => {
    const res = await api().post('/api/v2/posts').set('Authorization', alice.auth).send({});
    expect(res.status).toBe(400);
  });

  it('only lets the author update or delete', async () => {
    const post = await createPost(alice);

    const update = await api()
      .patch(`/api/v2/posts/${post._id}`)
      .set('Authorization', bob.auth)
      .send({ content: 'hijacked' });
    expect(update.status).toBe(403);

    const del = await api().delete(`/api/v2/posts/${post._id}`).set('Authorization', bob.auth);
    expect(del.status).toBe(403);

    const own = await api().delete(`/api/v2/posts/${post._id}`).set('Authorization', alice.auth);
    expect(own.status).toBe(200);
  });

  it('toggles likes', async () => {
    const post = await createPost(alice);
    const like = () => api().post(`/api/v2/posts/${post._id}/like`).set('Authorization', bob.auth);

    expect((await like()).body.data.likes).toHaveLength(1);
    expect((await like()).body.data.likes).toHaveLength(0);
  });

  it('adds comments and only lets their author delete them', async () => {
    const post = await createPost(alice);

    const res = await api()
      .post(`/api/v2/posts/${post._id}/comments`)
      .set('Authorization', bob.auth)
      .send({ content: 'Nice!' });
    expect(res.status).toBe(201);
    const comment = res.body.data.comments[0];

    const byAlice = await api()
      .delete(`/api/v2/posts/${post._id}/comments/${comment._id}`)
      .set('Authorization', alice.auth);
    expect(byAlice.status).toBe(403);

    const byBob = await api()
      .delete(`/api/v2/posts/${post._id}/comments/${comment._id}`)
      .set('Authorization', bob.auth);
    expect(byBob.status).toBe(200);
  });

  it('caps the page size', async () => {
    const res = await api().get('/api/v2/posts').query({ limit: 100000 }).set('Authorization', alice.auth);
    expect(res.body.pagination.limit).toBe(50);
  });

  it('returns 404 for unknown or malformed ids', async () => {
    const missing = await api().get('/api/v2/posts/000000000000000000000000').set('Authorization', alice.auth);
    expect(missing.status).toBe(404);

    const malformed = await api().get('/api/v2/posts/not-an-id').set('Authorization', alice.auth);
    expect(malformed.status).toBe(404);
  });

  describe('image uploads', () => {
    it('stores an uploaded image and removes it with the post', async () => {
      const res = await api()
        .post('/api/v2/posts')
        .set('Authorization', alice.auth)
        .field('content', 'with image')
        .attach('image', PNG, { filename: 'pic.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.data.image).toMatch(/^\/uploads\/.+\.webp$/);
      const files = [res.body.data.image, res.body.data.thumbnail].map((url) => path.join(uploadDir, path.basename(url)));
      files.forEach((file) => expect(fs.existsSync(file)).toBe(true));

      await api().delete(`/api/v2/posts/${res.body.data._id}`).set('Authorization', alice.auth);
      files.forEach((file) => expect(fs.existsSync(file)).toBe(false));
    });

    it('rejects non-image files', async () => {
      const res = await api()
        .post('/api/v2/posts')
        .set('Authorization', alice.auth)
        .field('content', 'bad file')
        .attach('image', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
    });
  });
});
