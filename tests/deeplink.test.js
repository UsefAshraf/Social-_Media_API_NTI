const emailService = require('../src/api/v2/services/email.service');
const { api, registerUser } = require('./helpers');

const TOKEN = 'ab'.repeat(32);

let resetTokens;
beforeEach(() => {
  resetTokens = [];
  jest.spyOn(emailService, 'sendResetEmail').mockImplementation(async (email, username, token) => {
    resetTokens.push(token);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.APP_SCHEME;
});

const requestReset = async (email) => {
  await api().get('/api/v2/auth/reset').query({ email });
  return resetTokens[resetTokens.length - 1];
};

const cspOf = (res) => res.headers['content-security-policy'];

describe('email link landing pages', () => {
  it.each([
    ['/reset-password', 'socialapp://reset-password', 'reset.js'],
    ['/verify-email', 'socialapp://verify-email', 'verify.js'],
  ])('%s renders the app link and fallback for a valid token', async (path, appLink, script) => {
    const res = await api().get(path).query({ token: TOKEN });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain(`href="${appLink}?token=${TOKEN}"`);
    expect(res.text).toContain('Open in app');
    expect(res.text).toContain(`<script src="/deeplink/${script}" defer></script>`);
    // no inline scripts or styles, so the strict CSP holds
    expect(res.text).not.toMatch(/<script>|<script(?![^>]*\ssrc=)[^>]*>/);
    expect(res.text).not.toMatch(/<style|style="/);
  });

  it('shows the reset form and verify button only for valid tokens', async () => {
    const reset = await api().get('/reset-password').query({ token: TOKEN });
    expect(reset.text).toContain('id="reset-form"');
    expect(reset.text).toContain('id="confirm-password"');

    const verify = await api().get('/verify-email').query({ token: TOKEN });
    expect(verify.text).toContain('id="verify-button"');
  });

  it.each(['/reset-password', '/verify-email'])('%s shows an error for missing or malformed tokens', async (path) => {
    const bad = [undefined, 'short', 'z'.repeat(64), `${TOKEN}0`, '"><script>alert(1)</script>'];

    for (const token of bad) {
      const res = await api().get(path).query(token === undefined ? {} : { token });
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Invalid link');
      expect(res.text).not.toContain('<form');
      expect(res.text).not.toContain('verify-button');
      expect(res.text).not.toContain('Open in app');
      expect(res.text).not.toContain('<script');
      if (token) expect(res.text).not.toContain(token);
    }
  });

  it('ignores array tokens from repeated query params', async () => {
    const res = await api().get(`/reset-password?token=${TOKEN}&token=${TOKEN}`);
    expect(res.status).toBe(400);
  });

  it.each(['/reset-password', '/verify-email'])('%s sends no-store, no-referrer and a strict CSP', async (path) => {
    for (const token of [TOKEN, 'bad']) {
      const res = await api().get(path).query({ token });
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['referrer-policy']).toBe('no-referrer');

      const csp = cspOf(res);
      expect(csp).toMatch(/default-src 'none'/);
      expect(csp).toMatch(/script-src 'self'(;|$)/);
      expect(csp).toMatch(/connect-src 'self'/);
      expect(csp).toMatch(/frame-ancestors 'none'/);
      expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
      expect(res.headers['x-frame-options']).toBeDefined();
    }
  });

  it('leaves the global Helmet CSP in place elsewhere', async () => {
    const csp = cspOf(await api().get('/health'));
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it('uses APP_SCHEME for the app link', async () => {
    process.env.APP_SCHEME = 'myapp';
    const res = await api().get('/verify-email').query({ token: TOKEN });
    expect(res.text).toContain(`href="myapp://verify-email?token=${TOKEN}"`);

    process.env.APP_SCHEME = 'javascript:alert(1)//';
    const fallback = await api().get('/verify-email').query({ token: TOKEN });
    expect(fallback.text).toContain(`href="socialapp://verify-email?token=${TOKEN}"`);
  });

  it('serves the page scripts and stylesheet as static files', async () => {
    for (const file of ['common.js', 'reset.js', 'verify.js']) {
      const res = await api().get(`/deeplink/${file}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/javascript/);
    }
    const css = await api().get('/deeplink/deeplink.css');
    expect(css.status).toBe(200);
    expect(css.headers['content-type']).toMatch(/text\/css/);
  });
});

describe('POST /api/v2/auth/reset', () => {
  const reset = (body, origin) => {
    const req = api().post('/api/v2/auth/reset');
    if (origin) req.set('Origin', origin);
    return req.send(body);
  };

  it('resets the password with the emailed token, once', async () => {
    const user = await registerUser();
    const token = await requestReset(user.email);
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    // the landing page for that token renders the form
    const page = await api().get('/reset-password').query({ token });
    expect(page.status).toBe(200);

    // the page's fetch is same-origin, so the browser sends its own Origin
    const res = await reset({ token, newPassword: 'brand-new-pass' }, 'http://127.0.0.1:5000');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });

    const login = await api().post('/api/v2/auth/login').send({ email: user.email, password: 'brand-new-pass' });
    expect(login.status).toBe(200);
    const old = await api().post('/api/v2/auth/login').send({ email: user.email, password: user.password });
    expect(old.status).toBe(401);

    const again = await reset({ token, newPassword: 'another-pass' });
    expect(again.status).toBe(400);
    expect(again.body).toMatchObject({ success: false, error: 'Invalid or expired token' });
    expect(again.body.message).toBeUndefined();
  });

  it('rejects unknown tokens with the standard error shape', async () => {
    const res = await reset({ token: TOKEN, newPassword: 'secret123' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'Invalid or expired token' });
  });

  it('validates the token format and password length', async () => {
    const user = await registerUser();
    const token = await requestReset(user.email);

    const short = await reset({ token, newPassword: '123' });
    expect(short.status).toBe(400);
    expect(short.body).toMatchObject({ success: false, error: 'Password must be at least 6 characters' });

    const badToken = await reset({ token: 'not-a-token', newPassword: 'secret123' });
    expect(badToken.status).toBe(400);
    expect(badToken.body).toMatchObject({ success: false, error: 'Invalid reset token' });

    const missing = await reset({});
    expect(missing.status).toBe(400);
    expect(missing.body.success).toBe(false);
    expect(missing.body.error).toMatch(/Reset token is required/);
    expect(missing.body.error).toMatch(/New password is required/);

    // the valid token survives the failed attempts
    expect((await reset({ token, newPassword: 'secret456' })).status).toBe(200);
  });
});
