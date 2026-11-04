const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');
const sharp = require('sharp');
const Notification = require('../src/shared/models/Notification');
const { uploadDir } = require('../src/shared/config/multerConfig');
const { cleanupNotifications } = require('../src/api/v2/services/notification.service');
const { api, registerUser } = require('./helpers');

const fileOf = (url) => path.join(uploadDir, path.basename(url));
const png = (width, height) =>
  sharp({ create: { width, height, channels: 3, background: '#4f46e5' } }).png().toBuffer();

describe('image processing (inline, no Redis)', () => {
  let alice;

  beforeEach(async () => {
    alice = await registerUser();
  });

  it('resizes post images to WebP with a thumbnail and drops the original', async () => {
    const before = new Set(fs.readdirSync(uploadDir));
    const res = await api()
      .post('/api/v2/posts')
      .set('Authorization', alice.auth)
      .field('content', 'big picture')
      .attach('image', await png(2000, 1000), { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    const image = await sharp(fileOf(res.body.data.image)).metadata();
    const thumb = await sharp(fileOf(res.body.data.thumbnail)).metadata();
    expect(image).toMatchObject({ format: 'webp', width: 1280, height: 640 });
    expect(thumb).toMatchObject({ format: 'webp', width: 320, height: 320 });

    const added = fs.readdirSync(uploadDir).filter((f) => !before.has(f));
    expect(added.sort()).toEqual([path.basename(res.body.data.image), path.basename(res.body.data.thumbnail)].sort());
  });

  it('does not upscale small images', async () => {
    const res = await api()
      .post('/api/v2/posts')
      .set('Authorization', alice.auth)
      .field('content', 'small')
      .attach('image', await png(300, 200), { filename: 'small.png', contentType: 'image/png' });

    expect(await sharp(fileOf(res.body.data.image)).metadata()).toMatchObject({ width: 300, height: 200 });
  });

  it('crops avatars to 256x256 WebP', async () => {
    const res = await api()
      .patch('/api/v2/users/profile')
      .set('Authorization', alice.auth)
      .attach('image', await png(800, 600), { filename: 'me.png', contentType: 'image/png' });

    expect(res.body.data.avatar).toMatch(/\.webp$/);
    expect(await sharp(fileOf(res.body.data.avatar)).metadata()).toMatchObject({ width: 256, height: 256 });
  });

  it('removes old files when a post image is replaced', async () => {
    const created = await api()
      .post('/api/v2/posts')
      .set('Authorization', alice.auth)
      .field('content', 'v1')
      .attach('image', await png(400, 400), { filename: 'a.png', contentType: 'image/png' });
    const old = [created.body.data.image, created.body.data.thumbnail].map(fileOf);

    await api()
      .patch(`/api/v2/posts/${created.body.data._id}`)
      .set('Authorization', alice.auth)
      .attach('image', await png(400, 400), { filename: 'b.png', contentType: 'image/png' });

    old.forEach((file) => expect(fs.existsSync(file)).toBe(false));
  });
});

describe('notification cleanup', () => {
  it('deletes only read notifications older than 90 days', async () => {
    const [alice, bob] = await Promise.all([registerUser(), registerUser()]);
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const base = { recipient: alice.id, sender: bob.id, type: 'follow', content: 'x' };

    await Notification.collection.insertMany(
      [
        { ...base, read: true, createdAt: old },
        { ...base, read: false, createdAt: old },
        { ...base, read: true, createdAt: new Date() },
      ].map((n) => ({ ...n, recipient: new mongoose.Types.ObjectId(n.recipient), sender: new mongoose.Types.ObjectId(n.sender) }))
    );

    expect(await cleanupNotifications()).toEqual({ deleted: 1 });
    expect(await Notification.countDocuments()).toBe(2);
  });
});
