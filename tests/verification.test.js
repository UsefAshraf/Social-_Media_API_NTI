const emailService = require('../src/api/v2/services/email.service');
const { api, registerUser } = require('./helpers');

// capture the raw token that would be emailed
let sentTokens;
beforeEach(() => {
  sentTokens = [];
  jest.spyOn(emailService, 'sendVerificationEmail').mockImplementation(async (email, username, token) => {
    sentTokens.push({ email, token });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
});

const verify = (token) => api().post('/api/v2/auth/verify-email').send({ token });
const profile = async (user) => (await api().get('/api/v2/users/profile').set('Authorization', user.auth)).body.data;

describe('email verification', () => {
  it('sends a token on registration and verifies it once', async () => {
    const user = await registerUser();
    expect(user.emailVerified).toBe(false);
    expect(sentTokens).toEqual([{ email: user.email, token: expect.stringMatching(/^[0-9a-f]{64}$/) }]);

    expect((await verify(sentTokens[0].token)).status).toBe(200);
    expect((await profile(user)).emailVerified).toBe(true);

    expect((await verify(sentTokens[0].token)).status).toBe(400);
  });

  it('rejects unknown and malformed tokens', async () => {
    await registerUser();
    expect((await verify('a'.repeat(64))).status).toBe(400);
    expect((await verify('not-a-token')).status).toBe(400);
  });

  it('resends a new token and invalidates the old one', async () => {
    const user = await registerUser();
    const res = await api().post('/api/v2/auth/resend-verification').set('Authorization', user.auth);
    expect(res.status).toBe(200);

    const [oldToken, newToken] = sentTokens.map((s) => s.token);
    expect((await verify(oldToken)).status).toBe(400);
    expect((await verify(newToken)).status).toBe(200);

    const again = await api().post('/api/v2/auth/resend-verification').set('Authorization', user.auth);
    expect(again.status).toBe(400);
  });

  it('blocks posting until verified when required', async () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
    const user = await registerUser();
    const post = () => api().post('/api/v2/posts').set('Authorization', user.auth).send({ content: 'hi' });

    expect((await post()).status).toBe(403);
    await verify(sentTokens[0].token);
    expect((await post()).status).toBe(201);
  });

  it('allows unverified users to post by default', async () => {
    const user = await registerUser();
    const res = await api().post('/api/v2/posts').set('Authorization', user.auth).send({ content: 'hi' });
    expect(res.status).toBe(201);
  });
});
