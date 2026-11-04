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

const cursorParam = {
  name: 'cursor',
  in: 'query',
  description: 'nextCursor from the previous page. Use instead of page for stable infinite scroll.',
  schema: { type: 'string' },
};

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
paths['/auth/verify-email'] = {
  post: {
    tags: ['Auth'],
    summary: 'Confirm an email address',
    description: 'The token comes from the link in the verification email.',
    requestBody: json({ type: 'object', required: ['token'], properties: { token: { type: 'string' } } }),
    responses: { 200: ok('Verified'), 400: ok('Invalid or expired token', ref('Error')) },
  },
};
paths['/auth/resend-verification'] = {
  post: {
    tags: ['Auth'],
    summary: 'Send a new verification email',
    security: bearer,
    responses: { 200: ok('Sent'), 400: ok('Already verified', ref('Error')), 401: errors[401] },
  },
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
paths['/users/blocked'] = {
  get: {
    tags: ['Users'],
    summary: 'Users you have blocked',
    security: bearer,
    responses: {
      200: ok('List', {
        type: 'object',
        properties: { count: { type: 'integer' }, data: { type: 'array', items: ref('UserSummary') } },
      }),
    },
  },
};
paths['/users/{id}/block'] = {
  post: {
    tags: ['Users'],
    summary: 'Block a user',
    description:
      'Removes follows both ways. Blocked users cannot see each other\'s profile or posts, follow, comment, like, message or notify each other.',
    security: bearer,
    parameters: [idParam('id', 'User to block')],
    responses: { 200: ok('Blocked'), 400: ok('Cannot block yourself', ref('Error')), 404: errors[404] },
  },
  delete: {
    tags: ['Users'],
    summary: 'Unblock a user',
    security: bearer,
    parameters: [idParam('id', 'User to unblock')],
    responses: { 200: ok('Unblocked') },
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
  ...postList('All posts, newest first', [cursorParam]),
  post: {
    tags: ['Posts'],
    summary: 'Create a post',
    description:
      'JSON with an image URL, or multipart with an `image` file (JPEG/PNG, max 5MB). ' +
      '#hashtags are indexed and @mentioned users are notified.',
    security: bearer,
    requestBody: postBody(['content']),
    responses: { 201: ok('Created', onePost), 400: errors[400] },
  },
};
paths['/posts/feed'] = postList('Posts from people you follow, plus your own', [cursorParam]);
paths['/posts/user/{userId}'] = postList("A user's posts", [idParam('userId', 'Author id')]);
paths['/posts/bookmarks'] = postList('Your saved posts, most recently saved first');
paths['/posts/{id}/bookmark'] = {
  post: {
    tags: ['Posts'],
    summary: 'Save a post',
    security: bearer,
    parameters: [idParam('id', 'Post id')],
    responses: { 200: ok('Saved'), 404: errors[404] },
  },
  delete: {
    tags: ['Posts'],
    summary: 'Remove a post from saved',
    security: bearer,
    parameters: [idParam('id', 'Post id')],
    responses: { 200: ok('Removed') },
  },
};
const windowParams = (defaultHours) => [
  { name: 'hours', in: 'query', description: 'Look-back window', schema: { type: 'integer', minimum: 1, maximum: 168, default: defaultHours } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
];
paths['/posts/trending'] = {
  get: {
    tags: ['Posts'],
    summary: 'Trending posts',
    description: 'Ranked by (likes + 2 x comments) / (age in hours + 2)^1.5.',
    security: bearer,
    parameters: windowParams(48),
    responses: { 200: ok('Posts with a score field', { type: 'object', properties: { data: { type: 'array', items: ref('Post') } } }) },
  },
};
paths['/hashtags/trending'] = {
  get: {
    tags: ['Search'],
    summary: 'Trending hashtags',
    description: 'Ranked by distinct authors, then by post count.',
    security: bearer,
    parameters: windowParams(24),
    responses: {
      200: ok('Hashtags', {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: { tag: { type: 'string' }, posts: { type: 'integer' }, authors: { type: 'integer' } },
            },
          },
        },
      }),
    },
  },
};
paths['/posts/hashtag/{tag}'] = postList('Posts with a hashtag', [
  { name: 'tag', in: 'path', required: true, description: 'Hashtag without #', schema: { type: 'string', example: 'nodejs' } },
]);
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
    description: 'Pass `parentId` to reply to a comment. Threads are one level deep.',
    requestBody: json({
      type: 'object',
      required: ['content'],
      properties: { content: { type: 'string', maxLength: 500 }, parentId: { type: 'string' } },
    }),
    responses: { 201: ok('Updated post', onePost), 400: errors[400], 404: errors[404] },
  },
};
paths['/posts/{id}/comments/{commentId}/like'] = {
  post: {
    tags: ['Posts'],
    summary: 'Like or unlike a comment (toggle)',
    security: bearer,
    parameters: [idParam('id', 'Post id'), idParam('commentId', 'Comment id')],
    responses: {
      200: ok('New state', {
        type: 'object',
        properties: {
          data: { type: 'object', properties: { liked: { type: 'boolean' }, likes: { type: 'integer' } } },
        },
      }),
      404: errors[404],
    },
  },
};
paths['/posts/{id}/comments/{commentId}'] = {
  delete: {
    tags: ['Posts'],
    summary: 'Delete your comment (and its replies)',
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

// --- Search
paths['/search'] = {
  get: {
    tags: ['Search'],
    summary: 'Search users, posts and hashtags',
    description: 'A leading `#` searches hashtags only, a leading `@` searches users only.',
    security: bearer,
    parameters: [
      { name: 'q', in: 'query', required: true, schema: { type: 'string', example: '#nodejs' } },
      { name: 'type', in: 'query', schema: { type: 'string', enum: ['all', 'users', 'posts', 'hashtags'], default: 'all' } },
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
    ],
    responses: {
      200: ok('Results', {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              users: { type: 'array', items: ref('UserSummary') },
              posts: { type: 'array', items: ref('Post') },
              hashtags: {
                type: 'array',
                items: { type: 'object', properties: { tag: { type: 'string' }, posts: { type: 'integer' } } },
              },
            },
          },
        },
      }),
      400: errors[400],
    },
  },
};

// --- Reports
paths['/reports'] = {
  post: {
    tags: ['Reports'],
    summary: 'Report a post, comment or user',
    description: '`postId` is required when reporting a comment. Each user can report a target once.',
    security: bearer,
    requestBody: json({
      type: 'object',
      required: ['targetType', 'targetId', 'reason'],
      properties: {
        targetType: { type: 'string', enum: ['post', 'comment', 'user'] },
        targetId: { type: 'string' },
        postId: { type: 'string' },
        reason: { type: 'string', enum: ['spam', 'harassment', 'hate', 'nudity', 'violence', 'misinformation', 'other'] },
        details: { type: 'string', maxLength: 500 },
      },
    }),
    responses: {
      201: ok('Report created'),
      400: errors[400],
      404: errors[404],
      409: ok('Already reported', ref('Error')),
    },
  },
};

// --- Admin
const adminOnly = { 403: ok('Admins only', ref('Error')) };
paths['/admin/stats'] = {
  get: {
    tags: ['Admin'],
    summary: 'Platform counters',
    security: bearer,
    responses: {
      200: ok('Stats', {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              users: { type: 'integer' },
              bannedUsers: { type: 'integer' },
              onlineUsers: { type: 'integer' },
              posts: { type: 'integer' },
              postsToday: { type: 'integer' },
              openReports: { type: 'integer' },
            },
          },
        },
      }),
      ...adminOnly,
    },
  },
};
paths['/admin/reports'] = {
  get: {
    tags: ['Admin'],
    summary: 'Reports queue',
    security: bearer,
    parameters: [
      { name: 'status', in: 'query', schema: { type: 'string', enum: ['open', 'resolved', 'dismissed'], default: 'open' } },
      ...pageParams,
    ],
    responses: { 200: ok('Page of reports'), ...adminOnly },
  },
};
paths['/admin/reports/{id}'] = {
  patch: {
    tags: ['Admin'],
    summary: 'Resolve or dismiss a report',
    description: 'When resolving, `action` can delete the reported post/comment or ban its author.',
    security: bearer,
    parameters: [idParam('id', 'Report id')],
    requestBody: json({
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['resolved', 'dismissed'] },
        action: { type: 'string', enum: ['none', 'delete_content', 'ban_user'], default: 'none' },
      },
    }),
    responses: { 200: ok('Updated report'), 400: errors[400], 404: errors[404], ...adminOnly },
  },
};
paths['/admin/posts/{id}'] = {
  delete: {
    tags: ['Admin'],
    summary: 'Delete any post',
    security: bearer,
    parameters: [idParam('id', 'Post id')],
    responses: { 200: ok('Deleted'), 404: errors[404], ...adminOnly },
  },
};
paths['/admin/users/{id}/ban'] = {
  patch: {
    tags: ['Admin'],
    summary: 'Ban or unban a user',
    description: 'Banned users are logged out and get 403 on every request.',
    security: bearer,
    parameters: [idParam('id', 'User id')],
    requestBody: json({ type: 'object', required: ['banned'], properties: { banned: { type: 'boolean' } } }),
    responses: { 200: ok('Updated user'), 400: errors[400], 404: errors[404], ...adminOnly },
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
    { name: 'Search' },
    { name: 'Reports' },
    { name: 'Admin', description: 'Requires role admin (`npm run make-admin -- <email>`)' },
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
          nextCursor: { type: 'string', nullable: true, description: 'Only on /posts and /posts/feed' },
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
          emailVerified: { type: 'boolean' },
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
              emailVerified: { type: 'boolean' },
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
          parentId: { type: 'string', nullable: true },
          likes: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Post: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          content: { type: 'string' },
          image: { type: 'string', example: '/uploads/1730000000000-ab12cd34ef56.webp' },
          thumbnail: { type: 'string', example: '/uploads/1730000000000-ab12cd34ef56-thumb.webp' },
          author: ref('UserSummary'),
          likes: { type: 'array', items: { type: 'string' } },
          hashtags: { type: 'array', items: { type: 'string' }, example: ['nodejs'] },
          mentions: { type: 'array', items: { type: 'string' } },
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
