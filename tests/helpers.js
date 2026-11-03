const request = require('supertest');
const { app } = require('../src/app');

let counter = 0;

const api = () => request(app);

const registerUser = async (overrides = {}) => {
  counter += 1;
  const body = {
    username: `user${counter}`,
    email: `user${counter}@example.com`,
    password: 'secret123',
    ...overrides,
  };
  const res = await api().post('/api/v2/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);

  const { user, accessToken, refreshToken } = res.body.data;
  return { ...user, password: body.password, token: accessToken, refreshToken, auth: `Bearer ${accessToken}` };
};

const createPost = async (user, content = 'Hello world') => {
  const res = await api().post('/api/v2/posts').set('Authorization', user.auth).send({ content });
  return res.body.data;
};

module.exports = {
  api,
  registerUser,
  createPost,
};
