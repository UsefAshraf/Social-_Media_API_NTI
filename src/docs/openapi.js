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

// --- Posts
const postList = (summary, extraParams = []) => ({
  get: {
    tags: ['Posts'],
    summary,
    security: bearer,
    parameters: [...extraParams, ...pageParams],
    responses: {
      200: ok('Page of posts', {
        type: 'object',
        properties: { data: { type: 'array', items: ref('Post') }, pagination: ref('Pagination') },
      }),
    },
  },
});
const postBody = (required) => ({
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required,
        properties: { content: { type: 'string', maxLength: 1000 }, image: { type: 'string', format: 'uri' } },
      },
    },
    'multipart/form-data': {
      schema: {
        type: 'object',
        required,
        properties: { content: { type: 'string' }, image: { type: 'string', format: 'binary' } },
      },
    },
  },
});
const onePost = { type: 'object', properties: { data: ref('Post') } };

paths['/posts'] = {
  ...postList('All posts, newest first'),
  post: {
    tags: ['Posts'],
    summary: 'Create a post',
    description: 'JSON with an image URL, or multipart with an `image` file (JPEG/PNG, max 5MB).',
    security: bearer,
    requestBody: postBody(['content']),
    responses: { 201: ok('Created', onePost), 400: errors[400] },
  },
};
paths['/posts/feed'] = postList('Posts from people you follow, plus your own');
paths['/posts/user/{userId}'] = postList("A user's posts", [idParam('userId', 'Author id')]);
paths['/posts/{id}'] = {
  get: {
    tags: ['Posts'],
    summary: 'Single post',
    security: bearer,
    parameters: [idParam('id', 'Post id')],
    responses: { 200: ok('Post', onePost), 404: errors[404] },
  },
  patch: {
    tags: ['Posts'],
    summary: 'Edit your post',
    security: bearer,
    parameters: [idParam('id', 'Post id')],
    requestBody: postBody([]),
    responses: { 200: ok('Updated', onePost), 403: ok('Not the author', ref('Error')), 404: errors[404] },
  },
  delete: {
    tags: ['Posts'],
    summary: 'Delete your post',
    security: bearer,
    parameters: [idParam('id', 'Post id')],
    responses: { 200: ok('Deleted'), 403: ok('Not the author', ref('Error')), 404: errors[404] },
  },
};
paths['/posts/{id}/like'] = {
  post: {
    tags: ['Posts'],
    summary: 'Like or unlike (toggle)',
    description: 'Liking notifies the author.',
    security: bearer,
    parameters: [idParam('id', 'Post id')],
    responses: { 200: ok('Updated post', onePost), 404: errors[404] },
  },
};
paths['/posts/{id}/comments'] = {
  post: {
    tags: ['Posts'],
    summary: 'Comment on a post',
    security: bearer,
    parameters: [idParam('id', 'Post id')],
    requestBody: json({ type: 'object', required: ['content'], properties: { content: { type: 'string', maxLength: 500 } } }),
    responses: { 201: ok('Updated post', onePost), 400: errors[400], 404: errors[404] },
  },
};
paths['/posts/{id}/comments/{commentId}'] = {
  delete: {
    tags: ['Posts'],
    summary: 'Delete your comment',
    security: bearer,
    parameters: [idParam('id', 'Post id'), idParam('commentId', 'Comment id')],
    responses: { 200: ok('Deleted'), 403: ok('Not the author', ref('Error')), 404: errors[404] },
  },
};

// --- Messages
paths['/messages/conversations'] = {
  get: {
    tags: ['Messages'],
    summary: 'Your conversations, most recent first',
    security: bearer,
    responses: {
      200: ok('Conversations', {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                room: { type: 'string' },
                user: ref('UserSummary'),
                lastMessage: ref('Message'),
                unreadCount: { type: 'integer' },
              },
            },
          },
        },
      }),
    },
  },
};
paths['/messages/{userId}'] = {
  get: {
    tags: ['Messages'],
    summary: 'Chat history with a user (newest first)',
    description: 'Pass the returned `nextCursor` as `before` to load older messages.',
    security: bearer,
    parameters: [
      idParam('userId', 'The other user'),
      { name: 'before', in: 'query', schema: { type: 'string', format: 'date-time' } },
      { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100, default: 30 } },
    ],
    responses: {
      200: ok('Messages', {
        type: 'object',
        properties: {
          data: { type: 'array', items: ref('Message') },
          nextCursor: { type: 'string', format: 'date-time', nullable: true },
        },
      }),
      404: errors[404],
    },
  },
};
paths['/messages/{userId}/read'] = {
  patch: {
    tags: ['Messages'],
    summary: 'Mark messages from a user as read',
    security: bearer,
    parameters: [idParam('userId', 'The other user')],
    responses: { 200: ok('Count updated'), 404: errors[404] },
  },
};

// --- Notifications
paths['/notifications'] = {
  get: {
    tags: ['Notifications'],
    summary: 'Your notifications, newest first',
    security: bearer,
    parameters: pageParams,
    responses: {
      200: ok('Page of notifications', {
        type: 'object',
        properties: {
          data: { type: 'array', items: ref('Notification') },
          unreadCount: { type: 'integer' },
          pagination: ref('Pagination'),
        },
      }),
    },
  },
};
paths['/notifications/read-all'] = {
  patch: { tags: ['Notifications'], summary: 'Mark all as read', security: bearer, responses: { 200: ok('Count updated') } },
};
paths['/notifications/{id}/read'] = {
  patch: {
    tags: ['Notifications'],
    summary: 'Mark one as read',
    security: bearer,
    parameters: [idParam('id', 'Notification id')],
    responses: { 200: ok('Updated', { type: 'object', properties: { data: ref('Notification') } }), 404: errors[404] },
  },
};
paths['/notifications/{id}'] = {
  delete: {
    tags: ['Notifications'],
    summary: 'Delete one',
    security: bearer,
    parameters: [idParam('id', 'Notification id')],
    responses: { 200: ok('Deleted'), 404: errors[404] },
  },
};

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
          type: { type: 'string', enum: ['message', 'comment', 'like', 'post', 'follow', 'mention'] },
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
