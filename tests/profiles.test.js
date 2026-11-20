const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const User = require('../src/shared/models/User');
const emailService = require('../src/api/v2/services/email.service');
const { uploadDir } = require('../src/shared/config/multerConfig');
const { api, registerUser, createPost } = require('./helpers');

const fileOf = (url) => path.join(uploadDir, path.basename(url));
const png = () => sharp({ create: { width: 300, height: 300, channels: 3, background: '#4f46e5' } }).png().toBuffer();

const get = (user, url) => api().get(`/api/v2/users${url}`).set('Authorization', user.auth);
const follow = (by, target) => api().post(`/api/v2/users/${target.id}/follow`).set('Authorization', by.auth);
const unfollow = (by, target) => api().delete(`/api/v2/users/${target.id}/follow`).set('Authorization', by.auth);
const block = (by, target) => api().post(`/api/v2/users/${target.id}/block`).set('Authorization', by.auth);
const patch = (user, body) => api().patch('/api/v2/users/profile').set('Authorization', user.auth).send(body);

let sentVerifications;
beforeEach(() => {
  sentVerifications = [];
  jest.spyOn(emailService, 'sendVerificationEmail').mockImplementation(async (email) => {
    sentVerifications.push(email);
  });
});

afterEach(() => jest.restoreAllMocks());

describe('profiles', () => {
  let alice;
  let bob;

  beforeEach(async () => {
    alice = await registerUser();
    bob = await registerUser();
  });

  it('returns private fields only on your own profile', async () => {
    await User.updateOne({ _id: bob.id }, { resetToken: 'secret', resetTokenExpiration: new Date() });

    const own = (await get(bob, '/profile')).body.data;
    expect(own).toMatchObject({ username: bob.username, email: bob.email, emailVerified: false, role: 'user', isMe: true, bio: '' });

    const other = await get(alice, `/${bob.id}`);
    expect(other.status).toBe(200);
    expect(other.body.data.isMe).toBe(false);
    for (const field of ['email', 'emailVerified', 'role', 'password', 'refreshToken', 'resetToken', 'resetTokenExpiration', 'verifyToken', 'blocked', 'bookmarks']) {
      expect(other.body.data).not.toHaveProperty(field);
    }
    for (const field of ['password', 'refreshToken', 'resetToken', 'resetTokenExpiration']) {
      expect(own).not.toHaveProperty(field);
    }
    expect(Object.keys(other.body.data).sort()).toEqual(
      ['_id', 'username', 'avatar', 'bio', 'followersCount', 'followingCount', 'postsCount', 'isMe', 'isFollowing', 'followsYou', 'createdAt', 'followers', 'following'].sort()
    );
  });

  it('reports counts and follow state before and after following', async () => {
    await createPost(bob, 'one');
    await createPost(bob, 'two');
    await follow(bob, alice);

    let profile = (await get(alice, `/${bob.id}`)).body.data;
    expect(profile).toMatchObject({ postsCount: 2, followersCount: 0, followingCount: 1, isFollowing: false, followsYou: true });

    const res = await follow(alice, bob);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe(`You are now following ${bob.username}`);
    expect(res.body.data).toEqual({ following: true, followersCount: 1, followingCount: 1 });

    profile = (await get(alice, `/${bob.id}`)).body.data;
    expect(profile).toMatchObject({ followersCount: 1, isFollowing: true, followsYou: true });
    expect(profile.followers).toEqual([alice.id]);

    const mine = (await get(alice, '/profile')).body.data;
    expect(mine).toMatchObject({ followingCount: 1, followersCount: 1, isFollowing: false, followsYou: false, postsCount: 0 });

    const off = await unfollow(alice, bob);
    expect(off.body.data).toEqual({ following: false, followersCount: 0, followingCount: 0 });
    profile = (await get(alice, `/${bob.id}`)).body.data;
    expect(profile).toMatchObject({ followersCount: 0, isFollowing: false });
  });

  it('returns 404 for malformed and unknown ids', async () => {
    expect((await get(alice, '/not-an-id')).status).toBe(404);
    expect((await get(alice, '/665f1c2e8b3e4a0012345678')).status).toBe(404);
    expect((await get(alice, '/not-an-id/followers')).status).toBe(404);
    expect((await api().post('/api/v2/users/not-an-id/follow').set('Authorization', alice.auth)).status).toBe(404);
  });

  it('updates the bio and rejects one over 160 characters', async () => {
    const res = await patch(alice, { bio: '  Hello there  ' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ bio: 'Hello there', email: alice.email, isMe: true });

    const tooLong = await patch(alice, { bio: 'x'.repeat(161) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.success).toBe(false);

    expect((await patch(alice, { bio: 'x'.repeat(160) })).status).toBe(200);
    expect((await patch(alice, { bio: '' })).body.data.bio).toBe('');
  });

  it('removes the avatar and its file', async () => {
    const uploaded = await api()
      .patch('/api/v2/users/profile')
      .set('Authorization', alice.auth)
      .field('bio', 'from multipart')
      .attach('image', await png(), { filename: 'me.png', contentType: 'image/png' });
    expect(uploaded.body.data.bio).toBe('from multipart');
    const file = fileOf(uploaded.body.data.avatar);
    expect(fs.existsSync(file)).toBe(true);

    const res = await patch(alice, { avatar: '' });
    expect(res.body.data.avatar).toBe('');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('rejects a taken username or email with 400', async () => {
    const username = await patch(alice, { username: bob.username });
    expect(username.status).toBe(400);
    expect(username.body).toMatchObject({ success: false, error: 'Username already exists' });

    const email = await patch(alice, { email: bob.email.toUpperCase() });
    expect(email.status).toBe(400);
    expect(email.body).toMatchObject({ success: false, error: 'Email already exists' });

    // keeping your own values is not a conflict
    expect((await patch(alice, { username: alice.username, email: alice.email })).status).toBe(200);
  });

  it('requires verifying a changed email again', async () => {
    await User.updateOne({ _id: alice.id }, { emailVerified: true });
    sentVerifications = [];

    const res = await patch(alice, { email: 'new.alice@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: 'new.alice@example.com', emailVerified: false });
    expect(sentVerifications).toEqual(['new.alice@example.com']);

    const stored = await User.findById(alice.id).select('+verifyToken');
    expect(stored.verifyToken).toEqual(expect.any(String));
  });
});

describe('connection lists', () => {
  let alice;
  let fans;

  beforeEach(async () => {
    alice = await registerUser();
    fans = [];
    for (let i = 0; i < 3; i += 1) {
      const fan = await registerUser();
      await follow(fan, alice);
      fans.push(fan);
    }
  });

  it('pages followers newest first with per-row follow state', async () => {
    await follow(alice, fans[1]);

    const first = (await get(alice, `/${alice.id}/followers?limit=2`)).body;
    expect(first.count).toBe(3);
    expect(first.pagination).toEqual({ page: 1, limit: 2, total: 3, pages: 2 });
    expect(first.data.map((u) => u.username)).toEqual([fans[2].username, fans[1].username]);
    expect(first.data.map((u) => u.isFollowing)).toEqual([false, true]);
    expect(Object.keys(first.data[0]).sort()).toEqual(['_id', 'avatar', 'bio', 'isFollowing', 'isMe', 'username']);

    const second = (await get(alice, `/${alice.id}/followers?limit=2&page=2`)).body;
    expect(second.data.map((u) => u.username)).toEqual([fans[0].username]);

    const following = (await get(fans[0], `/${fans[0].id}/following`)).body;
    expect(following.data).toEqual([expect.objectContaining({ username: alice.username, isMe: false, isFollowing: true })]);
    expect(following.pagination.limit).toBe(20);

    const seenByFan = (await get(fans[0], `/${alice.id}/followers`)).body;
    expect(seenByFan.data.find((u) => u._id === fans[0].id).isMe).toBe(true);
  });

  it('leaves out blocked users and hides blocked profiles', async () => {
    const viewer = await registerUser();
    await block(viewer, fans[1]);

    const list = (await get(viewer, `/${alice.id}/followers`)).body;
    expect(list.data.map((u) => u.username)).toEqual([fans[2].username, fans[0].username]);
    expect(list.pagination.total).toBe(2);

    await block(alice, viewer);
    expect((await get(viewer, `/${alice.id}/followers`)).status).toBe(404);
    expect((await get(viewer, `/${alice.id}/following`)).status).toBe(404);
  });

  it('pages the blocked list', async () => {
    for (const fan of fans) {
      const res = await block(alice, fan);
      expect(res.body.data).toEqual({ blocked: true });
    }

    const first = (await get(alice, '/blocked?limit=2')).body;
    expect(first.pagination).toEqual({ page: 1, limit: 2, total: 3, pages: 2 });
    expect(first.data.map((u) => u.username)).toEqual([fans[2].username, fans[1].username]);
    expect(first.data.every((u) => u.isFollowing === false && u.isMe === false)).toBe(true);

    const second = (await get(alice, '/blocked?limit=2&page=2')).body;
    expect(second.data.map((u) => u.username)).toEqual([fans[0].username]);

    const unblock = await api().delete(`/api/v2/users/${fans[0].id}/block`).set('Authorization', alice.auth);
    expect(unblock.body.data).toEqual({ blocked: false });
    expect((await get(alice, '/blocked')).body.count).toBe(2);
  });
});
