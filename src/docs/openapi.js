// OpenAPI 3 spec served at /api-docs
const bearer = [{ bearerAuth: [] }];

const idParam = (name, description) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', example: '665f1c2e8b3e4a0012345678' },
});

const pageParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
];

const json = (schema) => ({ content: { 'application/json': { schema } } });
const ok = (description, schema) => ({ description, ...(schema && json(schema)) });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const errors = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  404: { $ref: '#/components/responses/NotFound' },
};

const paths = {};

// --- Auth
paths['/auth/register'] = {
  post: {
    tags: ['Auth'],
    summary: 'Create an account',
    description: 'Also sets the refresh token as an httpOnly cookie.',
    requestBody: json({
      type: 'object',
      required: ['username', 'email', 'password'],
      properties: {
        username: { type: 'string', example: 'john_doe' },
        email: { type: 'string', example: 'john@example.com' },
        password: { type: 'string', minLength: 6, example: 'secret123' },
      },
    }),
    responses: { 201: ok('Registered', ref('AuthResult')), 400: errors[400] },
  },
};
paths['/auth/login'] = {
  post: {
    tags: ['Auth'],
    summary: 'Log in',
    requestBody: json({
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', example: 'john@example.com' },
        password: { type: 'string', example: 'secret123' },
      },
    }),
    responses: { 200: ok('Logged in', ref('AuthResult')), 401: errors[401], 429: ok('Too many attempts') },
  },
};
paths['/auth/refresh'] = {
  post: {
    tags: ['Auth'],
    summary: 'Get a new access token',
    description: 'Reads the refresh token from the cookie or the body. Rotates the refresh token; the old one stops working.',
    requestBody: { required: false, ...json({ type: 'object', properties: { refreshToken: { type: 'string' } } }) },
    responses: { 200: ok('New tokens', ref('AuthResult')), 401: errors[401] },
  },
};
paths['/auth/logout'] = {
  post: { tags: ['Auth'], summary: 'Log out', security: bearer, responses: { 200: ok('Logged out'), 401: errors[401] } },
};
paths['/auth/reset'] = {
  get: {
    tags: ['Auth'],
    summary: 'Email a password reset link',
    parameters: [{ name: 'email', in: 'query', required: true, schema: { type: 'string' } }],
    responses: { 200: ok('Sent if the account exists'), 400: errors[400] },
  },
  post: {
    tags: ['Auth'],
    summary: 'Set a new password with a reset token',
    requestBody: json({
      type: 'object',
      required: ['token', 'newPassword'],
      properties: { token: { type: 'string' }, newPassword: { type: 'string', minLength: 6 } },
    }),
    responses: { 200: ok('Password changed'), 400: ok('Invalid or expired token', ref('Error')) },
  },
};

// --- Users
paths['/users/profile'] = {
  get: {
    tags: ['Users'],
    summary: 'Current user',
    security: bearer,
    responses: { 200: ok('Profile', { type: 'object', properties: { data: ref('User') } }), 401: errors[401] },
  },
  patch: {
    tags: ['Users'],
    summary: 'Update profile',
    description: 'Send JSON, or multipart with an `image` file to upload an avatar (JPEG/PNG, max 5MB).',
    security: bearer,
    requestBody: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { username: { type: 'string' }, email: { type: 'string' }, avatar: { type: 'string', format: 'uri' } },
          },
        },
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: { username: { type: 'string' }, image: { type: 'string', format: 'binary' } },
          },
        },
      },
    },
    responses: { 200: ok('Updated', { type: 'object', properties: { data: ref('User') } }), 400: errors[400] },
  },
};
paths['/users/{id}'] = {
  get: {
    tags: ['Users'],
    summary: 'User by id',
    security: bearer,
    parameters: [idParam('id', 'User id')],
    responses: { 200: ok('Profile', { type: 'object', properties: { data: ref('User') } }), 404: errors[404] },
  },
};
paths['/users/{id}/follow'] = {
  post: {
    tags: ['Users'],
    summary: 'Follow a user',
    security: bearer,
    parameters: [idParam('id', 'User to follow')],
    responses: { 200: ok('Following'), 400: ok('Cannot follow yourself', ref('Error')), 404: errors[404] },
  },
  delete: {
    tags: ['Users'],
    summary: 'Unfollow a user',
    security: bearer,
    parameters: [idParam('id', 'User to unfollow')],
    responses: { 200: ok('Unfollowed'), 404: errors[404] },
  },
};
const connections = (summary) => ({
  get: {
    tags: ['Users'],
    summary,
    security: bearer,
    parameters: [idParam('id', 'User id')],
    responses: {
      200: ok('List', {
        type: 'object',
        properties: { count: { type: 'integer' }, data: { type: 'array', items: ref('UserSummary') } },
      }),
      404: errors[404],
    },
  },
});
paths['/users/{id}/followers'] = connections('Followers of a user');
paths['/users/{id}/following'] = connections('Users this user follows');

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Social Media API',
    version: '2.0.0',
    description:
      'REST + Socket.IO social media backend. Authenticate with `POST /auth/login`, then click **Authorize** and paste the access token.\n\n' +
      '### Socket.IO events\n' +
      'Connect with `io(url, { auth: { token } })`.\n\n' +
      '| Direction | Event | Payload |\n|---|---|---|\n' +
      '| emit | `chat:join` | `{ userId }` |\n' +
      '| emit | `chat:message` | `{ receiverId, content }` |\n' +
      '| emit | `chat:typing` | `{ receiverId, isTyping }` |\n' +
      '| emit | `chat:leave` | `{ userId }` |\n' +
      '| emit | `presence:query` | `{ userIds }` (ack: `[{ userId, status, lastSeen }]`) |\n' +
      '| emit | `notification:markAsRead` | `{ notificationId }` |\n' +
      '| emit | `notification:markAllAsRead` | – |\n' +
      '| listen | `chat:message` | `{ message }` |\n' +
      '| listen | `chat:typing` | `{ userId, isTyping }` |\n' +
      '| listen | `notification:new` | Notification |\n' +
      '| listen | `presence:update` | `{ userId, status, lastSeen }` |',
  },
  servers: [{ url: '/api/v2' }],
  tags: [
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Posts' },
    { name: 'Messages' },
    { name: 'Notifications' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    responses: {
      BadRequest: ok('Invalid input', ref('Error')),
      Unauthorized: ok('Missing or invalid token', ref('Error')),
      NotFound: ok('Resource not found', ref('Error')),
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { success: { type: 'boolean', example: false }, error: { type: 'string' } },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          pages: { type: 'integer' },
        },
      },
      UserSummary: {
        type: 'object',
        properties: { _id: { type: 'string' }, username: { type: 'string' }, avatar: { type: 'string' } },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          avatar: { type: 'string' },
          followers: { type: 'array', items: { type: 'string' } },
          following: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['online', 'offline'] },
          lastSeen: { type: 'string', format: 'date-time' },
        },
      },
      AuthResult: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              username: { type: 'string' },
              email: { type: 'string' },
              avatar: { type: 'string' },
            },
          },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          author: ref('UserSummary'),
          content: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Post: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          content: { type: 'string' },
          image: { type: 'string', example: '/uploads/1730000000000-ab12cd34ef56.png' },
          author: ref('UserSummary'),
          likes: { type: 'array', items: { type: 'string' } },
          comments: { type: 'array', items: ref('Comment') },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          sender: ref('UserSummary'),
          receiver: ref('UserSummary'),
          content: { type: 'string' },
          room: { type: 'string' },
          read: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          type: { type: 'string', enum: ['message', 'comment', 'like', 'post', 'follow'] },
          content: { type: 'string', example: 'alice liked your post' },
          sender: ref('UserSummary'),
          link: { type: 'string', example: '/posts/665f1c2e8b3e4a0012345678' },
          read: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths,
};
