jest.mock('cloudinary', () => ({
  v2: {
    uploader: {
      upload: jest.fn(async (file, options) => ({
        secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${options.folder}/${options.public_id}.webp`,
      })),
      destroy: jest.fn(async () => ({ result: 'ok' })),
    },
  },
}));

const fs = require('fs');
const sharp = require('sharp');
const { v2: cloudinary } = require('cloudinary');
const { uploadDir } = require('../src/shared/config/multerConfig');
const { publicIdFromUrl } = require('../src/shared/storage');
const { api, registerUser } = require('./helpers');

const png = () => sharp({ create: { width: 600, height: 400, channels: 3, background: '#0ea5e9' } }).png().toBuffer();

describe('Cloudinary storage', () => {
  beforeEach(() => {
    process.env.STORAGE_DRIVER = 'cloudinary';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.STORAGE_DRIVER;
  });

  it('extracts public ids from delivery URLs', () => {
    expect(publicIdFromUrl('https://res.cloudinary.com/demo/image/upload/v1712/social-media-api/abc-thumb.webp')).toBe(
      'social-media-api/abc-thumb'
    );
    expect(publicIdFromUrl('https://res.cloudinary.com/demo/image/upload/folder/x.png')).toBe('folder/x');
  });

  it('uploads processed images and keeps nothing on local disk', async () => {
    const alice = await registerUser();
    const before = fs.readdirSync(uploadDir).length;

    const res = await api()
      .post('/api/v2/posts')
      .set('Authorization', alice.auth)
      .field('content', 'to the cloud')
      .attach('image', await png(), { filename: 'cloud.png', contentType: 'image/png' });

    expect(res.body.data.image).toMatch(/^https:\/\/res\.cloudinary\.com\/.+\.webp$/);
    expect(res.body.data.thumbnail).toMatch(/-thumb\.webp$/);
    expect(cloudinary.uploader.upload).toHaveBeenCalledTimes(2);
    expect(fs.readdirSync(uploadDir).length).toBe(before);

    await api().delete(`/api/v2/posts/${res.body.data._id}`).set('Authorization', alice.auth);
    const destroyed = cloudinary.uploader.destroy.mock.calls.map(([id]) => id);
    expect(destroyed).toEqual([publicIdFromUrl(res.body.data.image), publicIdFromUrl(res.body.data.thumbnail)]);
  });
});

describe('cookies for cross-site frontends', () => {
  afterEach(() => {
    delete process.env.COOKIE_SAMESITE;
  });

  it('uses SameSite=Strict by default', async () => {
    const res = await api().post('/api/v2/auth/register').send({ username: 'strict_user', email: 's@example.com', password: 'secret123' });
    expect(res.headers['set-cookie'].join()).toMatch(/SameSite=Strict/);
  });
});
