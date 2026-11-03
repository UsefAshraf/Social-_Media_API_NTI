const { api, registerUser } = require('./helpers');

describe('auth', () => {
  it('registers a user and returns tokens without the password', async () => {
    const res = await api()
      .post('/api/v2/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ username: 'alice', email: 'alice@example.com' });
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers['set-cookie'].join()).toMatch(/refreshToken=.*HttpOnly/);
  });

  it('rejects duplicate emails', async () => {
    await registerUser({ email: 'dup@example.com' });
    const res = await api()
      .post('/api/v2/auth/register')
      .send({ username: 'other', email: 'dup@example.com', password: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email already exists');
  });

  it('validates the register body', async () => {
    const res = await api().post('/api/v2/auth/register').send({ username: 'a', email: 'nope' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Username must be at least 3 characters/);
  });

  it('logs in with the right password only', async () => {
    const user = await registerUser();

    const ok = await api().post('/api/v2/auth/login').send({ email: user.email, password: user.password });
    expect(ok.status).toBe(200);

    const bad = await api().post('/api/v2/auth/login').send({ email: user.email, password: 'wrong-pass' });
    expect(bad.status).toBe(401);
  });

  it('rotates refresh tokens and rejects the old one', async () => {
    const user = await registerUser();
    // JWTs issued in the same second are identical
    await new Promise((r) => setTimeout(r, 1100));

    const first = await api().post('/api/v2/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.data.refreshToken).not.toBe(user.refreshToken);

    const reused = await api().post('/api/v2/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(reused.status).toBe(401);
  });

  it('invalidates the refresh token on logout', async () => {
    const user = await registerUser();

    const out = await api().post('/api/v2/auth/logout').set('Authorization', user.auth);
    expect(out.status).toBe(200);

    const res = await api().post('/api/v2/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(res.status).toBe(401);
  });

  it('protects routes that need a token', async () => {
    const res = await api().get('/api/v2/users/profile');
    expect(res.status).toBe(401);
  });

  it('answers password reset requests without revealing accounts', async () => {
    const res = await api().get('/api/v2/auth/reset').query({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
  });
});
