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
