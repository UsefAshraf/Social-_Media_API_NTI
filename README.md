# Social Media API

[![CI](https://github.com/UsefAshraf/Social-_Media_API_NTI/actions/workflows/ci.yml/badge.svg)](https://github.com/UsefAshraf/Social-_Media_API_NTI/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-20%20%7C%2022-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

A production-style social media backend: REST API plus real-time chat, notifications and presence over Socket.IO.
Built with Node.js, Express and MongoDB, tested with Jest, documented with OpenAPI and shipped as a Docker image.

## Features

- **Auth**: JWT access tokens + rotating refresh tokens (httpOnly cookie), password reset by email with hashed one-time tokens, rate-limited auth routes
- **Posts**: create/edit/delete with image uploads, likes, comments, pagination
- **Social graph**: follow/unfollow, followers/following lists, a personalised feed
- **Real-time chat**: private 1:1 rooms, typing indicators, message history with cursor pagination, conversation list with unread counts
- **Notifications**: generated server-side on likes, comments and follows, pushed live over Socket.IO and available over REST
- **Presence**: online/offline status and last seen, correct across multiple tabs/devices
- **Security**: Helmet, CORS allow-list, NoSQL-injection sanitising, Joi validation, upload type/size limits, per-user authorisation on every resource
- **Quality**: 33 integration tests (REST + Socket.IO) on an in-memory MongoDB, CI on Node 20 and 22, Swagger UI at `/api-docs`

## Tech stack

| Area | Tools |
|---|---|
| Runtime | Node.js, Express 4 |
| Database | MongoDB, Mongoose 8 |
| Real-time | Socket.IO 4 |
| Auth | jsonwebtoken, bcryptjs, express-rate-limit |
| Validation & security | Joi, Helmet, express-mongo-sanitize, CORS |
| Uploads & email | Multer, Nodemailer |
| Testing | Jest, Supertest, mongodb-memory-server, socket.io-client |
| Docs & DevOps | OpenAPI 3 / Swagger UI, Docker, docker compose, GitHub Actions |

## Getting started

### With Docker (recommended)

```bash
cp .env.example .env        # then set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
docker compose up --build
```

The API runs on http://localhost:5000 with MongoDB in a container and uploads in a named volume.

### Locally

Requires Node.js 20+ and a MongoDB instance.

```bash
npm install
cp .env.example .env        # set MONGODB_URI and the JWT secrets
npm run dev                 # or: npm start
```

Check it is up: `curl http://localhost:5000/health`, then open **http://localhost:5000/api-docs**.

### Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP port |
| `MONGODB_URI` | – | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | – | Token signing secrets (required) |
| `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` | `15m` / `7d` | Token lifetimes |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated frontend origins (HTTP and Socket.IO) |
| `AUTH_RATE_LIMIT_MAX` | `20` | Auth requests per IP per 15 minutes |
| `EMAIL` / `PASSWORD` | – | Gmail address and app password; emails are skipped if unset |
| `FRONTEND_URL` | `http://localhost:3000` | Base URL for password reset links |

## API

Full interactive reference: **`/api-docs`** (raw spec at `/api-docs.json`). A Postman collection is also included.
All routes are under `/api/v2` and, except register/login/refresh/reset, need `Authorization: Bearer <accessToken>`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/reset?email=` · `POST /auth/reset` |
| Users | `GET /users/profile` · `PATCH /users/profile` · `GET /users/:id` · `POST/DELETE /users/:id/follow` · `GET /users/:id/followers` · `GET /users/:id/following` |
| Posts | `GET/POST /posts` · `GET /posts/feed` · `GET /posts/user/:userId` · `GET/PATCH/DELETE /posts/:id` · `POST /posts/:id/like` · `POST /posts/:id/comments` · `DELETE /posts/:id/comments/:commentId` |
| Messages | `GET /messages/conversations` · `GET /messages/:userId?before=&limit=` · `PATCH /messages/:userId/read` |
| Notifications | `GET /notifications` · `PATCH /notifications/read-all` · `PATCH /notifications/:id/read` · `DELETE /notifications/:id` |

Images are uploaded as multipart field `image` (JPEG/PNG, max 5MB) on `POST/PATCH /posts` and `PATCH /users/profile`, and served from `/uploads`.

Errors share one shape: `{ "success": false, "error": "message" }`.

### Socket.IO

```js
const socket = io("http://localhost:5000", { auth: { token: accessToken } });

socket.emit("chat:message", { receiverId, content: "Hi!" });
socket.on("chat:message", ({ message }) => render(message));
socket.on("notification:new", (notification) => toast(notification.content));
socket.on("presence:update", ({ userId, status, lastSeen }) => updateDot(userId, status));
const statuses = await socket.emitWithAck("presence:query", { userIds });
```

| Emit | Listen |
|---|---|
| `chat:join`, `chat:leave` `{ userId }` | `chat:joined` |
| `chat:message` `{ receiverId, content }` | `chat:message` `{ message }` |
| `chat:typing` `{ receiverId, isTyping }` | `chat:typing` `{ userId, isTyping }` |
| `notification:markAsRead` `{ notificationId }`, `notification:markAllAsRead` | `notification:new` |
| `presence:query` `{ userIds }` | `presence:update` `{ userId, status, lastSeen }` |
| | `chat:error`, `notification:error`, `presence:error` |

## Architecture

```
src/
├── app.js                  # Express app, HTTP server, Socket.IO, graceful shutdown
├── api/v2/
│   ├── routes/             # URL → middleware → controller
│   ├── controllers/        # HTTP handling
│   ├── services/           # business logic (auth, email, messages, notifications)
│   └── validators/         # Joi schemas
├── sockets/                # chat, notification and presence handlers
├── docs/openapi.js         # OpenAPI 3 spec
└── shared/
    ├── config/             # db, multer, nodemailer
    ├── middleware/         # auth, validation, rate limiting, error handler
    ├── models/             # User, Post, Message, Notification
    └── utils/
tests/                      # Jest + Supertest + Socket.IO client
```

Some design decisions:

- **Refresh-token rotation**: each refresh issues a new token and invalidates the previous one, so a leaked token stops working once the real client refreshes.
- **Notifications are server-side only**: clients can't create them, they're a side effect of likes, comments and follows. Ownership is enforced inside each query (`{ _id, recipient }`), so another user's id just returns 404.
- **Chat rooms** are deterministic (`sortedUserIdA_sortedUserIdB`), and messages also go to the receiver's personal room, so they arrive even with the chat closed.
- **Presence** counts sockets per user, so closing one of several tabs doesn't mark you offline. Stale statuses are reset on startup.
- **A failed notification or email never fails the request** that triggered it.

## Testing

```bash
npm test                 # 33 tests, in-memory MongoDB, no setup needed
npm run test:coverage    # ~83% line coverage
```

The suite covers auth flows (including token rotation and logout), post permissions, uploads, follows and the feed, notification scoping, Socket.IO chat, live notifications and presence. It also fails if any route is missing from the OpenAPI spec.
