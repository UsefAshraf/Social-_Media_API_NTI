# Social Media API

A comprehensive REST API built with Node.js, Express, MongoDB, and Socket.io for real-time features. This API provides authentication, user management, posts, comments, likes, real-time chat, and notifications.

[![Node.js](https://img.shields.io/badge/Node.js-v14+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-v4.18-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v8.0-green.svg)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4.8-black.svg)](https://socket.io/)

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
  - [Authentication](#authentication)
  - [Users](#users)
  - [Posts](#posts)
- [WebSocket Events](#websocket-events)
  - [Chat Events](#chat-events)
  - [Notification Events](#notification-events)
- [Security](#security)
- [Error Handling](#error-handling)

## ✨ Features

- 🔐 **JWT Authentication** - Secure token-based authentication with access and refresh tokens
- 👤 **User Management** - Profile management and user operations
- 📝 **Posts & Comments** - Create, read, update, and delete posts with commenting functionality
- ❤️ **Likes System** - Like/unlike posts
- 💬 **Real-time Chat** - WebSocket-based instant messaging
- 🔔 **Real-time Notifications** - Live notifications for user interactions
- 🔒 **Security** - Helmet, CORS, MongoDB sanitization, and bcrypt password hashing
- ✅ **Input Validation** - Joi schema validation for all requests
- 📁 **File Upload** - Multer integration for image uploads
- 🔄 **API Versioning** - Support for multiple API versions (v1, v2)

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken)
- **Real-time**: Socket.io
- **Validation**: Joi
- **Security**: Helmet, CORS, bcryptjs, express-mongo-sanitize
- **File Upload**: Multer
- **Email**: Nodemailer

## 📁 Project Structure

```
social-media-api/
├── src/
│   ├── api/                      # API versions
│   │   ├── v1/                   # Version 1 API
│   │   └── v2/                   # Version 2 API (Current)
│   │       ├── controllers/      # Request handlers
│   │       │   ├── auth.controller.js
│   │       │   ├── user.controller.js
│   │       │   └── post.controller.js
│   │       ├── routes/           # Route definitions
│   │       │   ├── auth.routes.js
│   │       │   ├── user.routes.js
│   │       │   └── post.routes.js
│   │       ├── services/         # Business logic
│   │       │   ├── auth.service.js
│   │       │   ├── message.service.js
│   │       │   └── notification.service.js
│   │       └── validators/       # Request validation schemas
│   │           ├── auth.validator.js
│   │           ├── user.validator.js
│   │           └── post.validator.js
│   │
│   ├── shared/                   # Shared across all versions
│   │   ├── config/               # Configuration files
│   │   │   ├── db.js
│   │   │   └── multerConfig.js
│   │   ├── middleware/           # Shared middleware
│   │   │   ├── auth.js
│   │   │   ├── errorHandler.js
│   │   │   └── validate.js
│   │   ├── models/               # Database models
│   │   │   ├── User.js
│   │   │   ├── Post.js
│   │   │   ├── Message.js
│   │   │   └── Notification.js
│   │   └── utils/                # Utility functions
│   │       ├── ApiError.js
│   │       ├── asyncHandler.js
│   │       └── tokens.js
│   │
│   ├── sockets/                  # WebSocket handlers
│   │   ├── index.js
│   │   ├── chatHandler.js
│   │   └── notificationHandler.js
│   │
│   └── app.js                    # Express app configuration
│
├── uploads/                      # Uploaded files directory
├── .env                          # Environment variables
├── .gitignore
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd social-media-api
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/social-media-api

# JWT Secrets
JWT_ACCESS_SECRET=your_access_token_secret_here
JWT_REFRESH_SECRET=your_refresh_token_secret_here
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Email Configuration (for password reset)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000
```

4. **Start MongoDB**

Make sure MongoDB is running locally or update `MONGODB_URI` with your MongoDB Atlas connection string.

5. **Run the server**

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

### Verify Installation

Test the health endpoint:

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{
  "status": "OK",
  "message": "Server is running"
}
```

## 📚 API Documentation

Base URL: `http://localhost:5000/api/v2`

All protected endpoints require an `Authorization` header with a Bearer token:

```
Authorization: Bearer <your_access_token>
```

### Authentication

#### Register a New User

**Endpoint:** `POST /api/v2/auth/register`

**Request Body:**

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Validation Rules:**

- `username`: 3-30 characters, alphanumeric and underscores only
- `email`: Valid email format
- `password`: Minimum 6 characters

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "john@example.com",
      "avatar": "",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "Username must be at least 3 characters"
}
```

---

#### Login

**Endpoint:** `POST /api/v2/auth/login`

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "john@example.com",
      "avatar": ""
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (401):**

```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

---

#### Refresh Access Token

**Endpoint:** `POST /api/v2/auth/refresh`

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

#### Logout

**Endpoint:** `POST /api/v2/auth/logout`

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### Request Password Reset

**Endpoint:** `GET /api/v2/auth/reset?email=john@example.com`

**Query Parameters:**

- `email`: User's email address

**Success Response (200):**

```json
{
  "success": true,
  "message": "Password reset link sent to your email"
}
```

---

#### Submit New Password

**Endpoint:** `POST /api/v2/auth/reset`

**Request Body:**

```json
{
  "token": "reset_token_from_email",
  "newPassword": "newpassword123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Password reset successful"
}
```

---

### Users

#### Get Current User Profile

**Endpoint:** `GET /api/v2/users/profile`

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "avatar": "https://example.com/avatar.jpg",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

#### Get User by ID

**Endpoint:** `GET /api/v2/users/:id`

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "avatar": "https://example.com/avatar.jpg",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

#### Update Profile

**Endpoint:** `PATCH /api/v2/users/profile`

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**

```json
{
  "username": "john_updated",
  "email": "newemail@example.com",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

**Validation Rules:**

- `username`: 3-30 characters, alphanumeric and underscores only (optional)
- `email`: Valid email format (optional)
- `avatar`: Valid URL (optional)

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "john_updated",
    "email": "newemail@example.com",
    "avatar": "https://example.com/new-avatar.jpg",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

---

### Posts

#### Create a Post

**Endpoint:** `POST /api/v2/posts`

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**

```json
{
  "content": "This is my first post!",
  "image": "https://example.com/post-image.jpg"
}
```

**Validation Rules:**

- `content`: Required, max 1000 characters
- `image`: Optional, valid URL

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "content": "This is my first post!",
    "image": "https://example.com/post-image.jpg",
    "author": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "likes": [],
    "comments": [],
    "createdAt": "2024-01-15T12:00:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z"
  }
}
```

---

#### Get All Posts

**Endpoint:** `GET /api/v2/posts`

**Headers:** `Authorization: Bearer <access_token>`

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Posts per page (default: 10)

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "content": "This is my first post!",
        "image": "https://example.com/post-image.jpg",
        "author": {
          "_id": "507f1f77bcf86cd799439011",
          "username": "johndoe",
          "avatar": "https://example.com/avatar.jpg"
        },
        "likes": ["507f1f77bcf86cd799439013"],
        "likesCount": 1,
        "commentsCount": 2,
        "createdAt": "2024-01-15T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalPosts": 47,
      "hasMore": true
    }
  }
}
```

---

#### Get Single Post

**Endpoint:** `GET /api/v2/posts/:id`

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "content": "This is my first post!",
    "image": "https://example.com/post-image.jpg",
    "author": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "likes": ["507f1f77bcf86cd799439013"],
    "comments": [
      {
        "_id": "507f1f77bcf86cd799439014",
        "content": "Great post!",
        "author": {
          "_id": "507f1f77bcf86cd799439013",
          "username": "janedoe"
        },
        "createdAt": "2024-01-15T12:30:00.000Z"
      }
    ],
    "createdAt": "2024-01-15T12:00:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z"
  }
}
```

---

#### Update Post

**Endpoint:** `PATCH /api/v2/posts/:id`

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**

```json
{
  "content": "Updated post content",
  "image": "https://example.com/updated-image.jpg"
}
```

**Validation Rules:**

- `content`: Optional, max 1000 characters
- `image`: Optional, valid URL

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "content": "Updated post content",
    "image": "https://example.com/updated-image.jpg",
    "author": "507f1f77bcf86cd799439011",
    "updatedAt": "2024-01-15T13:00:00.000Z"
  }
}
```

---

#### Delete Post

**Endpoint:** `DELETE /api/v2/posts/:id`

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**

```json
{
  "success": true,
  "message": "Post deleted successfully"
}
```

---

#### Like/Unlike Post

**Endpoint:** `POST /api/v2/posts/:id/like`

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "liked": true,
    "likesCount": 5
  }
}
```

---

#### Add Comment to Post

**Endpoint:** `POST /api/v2/posts/:id/comments`

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**

```json
{
  "content": "This is a great post!"
}
```

**Validation Rules:**

- `content`: Required, max 500 characters

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "content": "This is a great post!",
    "author": {
      "_id": "507f1f77bcf86cd799439013",
      "username": "janedoe",
      "avatar": "https://example.com/jane-avatar.jpg"
    },
    "createdAt": "2024-01-15T12:30:00.000Z"
  }
}
```

---

#### Delete Comment

**Endpoint:** `DELETE /api/v2/posts/:id/comments/:commentId`

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**

```json
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

---

## 🔌 WebSocket Events

Connect to WebSocket server at: `ws://localhost:5000`

### Authentication

WebSocket connections require authentication. Include the JWT token in the connection handshake:

**JavaScript Example:**

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    token: "your_access_token_here",
  },
});
```

**Alternative (using headers):**

```javascript
const socket = io("http://localhost:5000", {
  extraHeaders: {
    Authorization: "Bearer your_access_token_here",
  },
});
```

---

### Chat Events

#### Join Chat Room

**Event:** `chat:join`

**Emit:**

```javascript
socket.emit("chat:join", {
  userId: "507f1f77bcf86cd799439013", // ID of user to chat with
});
```

**Listen:**

```javascript
socket.on("chat:joined", (data) => {
  console.log("Joined room:", data.room);
  console.log("Chat with user:", data.userId);
});
```

**Response:**

```json
{
  "room": "507f1f77bcf86cd799439011_507f1f77bcf86cd799439013",
  "userId": "507f1f77bcf86cd799439013"
}
```

---

#### Send Message

**Event:** `chat:message`

**Emit:**

```javascript
socket.emit("chat:message", {
  receiverId: "507f1f77bcf86cd799439013",
  content: "Hello! How are you?",
});
```

**Listen:**

```javascript
socket.on("chat:message", (data) => {
  console.log("New message:", data.message);
});
```

**Response:**

```json
{
  "message": {
    "_id": "507f1f77bcf86cd799439015",
    "sender": "507f1f77bcf86cd799439011",
    "receiver": "507f1f77bcf86cd799439013",
    "content": "Hello! How are you?",
    "room": "507f1f77bcf86cd799439011_507f1f77bcf86cd799439013",
    "read": false,
    "createdAt": "2024-01-15T14:00:00.000Z"
  }
}
```

---

#### Typing Indicator

**Event:** `chat:typing`

**Emit:**

```javascript
socket.emit("chat:typing", {
  receiverId: "507f1f77bcf86cd799439013",
  isTyping: true,
});
```

**Listen:**

```javascript
socket.on("chat:typing", (data) => {
  console.log(`User ${data.userId} is typing:`, data.isTyping);
});
```

**Response:**

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "isTyping": true
}
```

---

#### Leave Chat Room

**Event:** `chat:leave`

**Emit:**

```javascript
socket.emit("chat:leave", {
  userId: "507f1f77bcf86cd799439013",
});
```

---

#### Chat Error

**Event:** `chat:error`

**Listen:**

```javascript
socket.on("chat:error", (data) => {
  console.error("Chat error:", data.message);
});
```

**Response:**

```json
{
  "message": "Failed to send message",
  "error": "Error details..."
}
```

---

### Notification Events

#### Send Notification

**Event:** `notification:notify`

**Emit:**

```javascript
socket.emit("notification:notify", {
  recipient: "507f1f77bcf86cd799439013",
  type: "like", // 'like', 'comment', 'follow', 'message'
  content: "John liked your post",
  link: "/posts/507f1f77bcf86cd799439012",
  relatedId: "507f1f77bcf86cd799439012", // Post ID, Comment ID, etc.
});
```

**Listen (Recipient):**

```javascript
socket.on("notification:new", (notification) => {
  console.log("New notification:", notification);
});
```

**Response:**

```json
{
  "_id": "507f1f77bcf86cd799439016",
  "recipient": "507f1f77bcf86cd799439013",
  "sender": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "avatar": "https://example.com/avatar.jpg"
  },
  "type": "like",
  "content": "John liked your post",
  "link": "/posts/507f1f77bcf86cd799439012",
  "relatedId": "507f1f77bcf86cd799439012",
  "read": false,
  "createdAt": "2024-01-15T14:30:00.000Z"
}
```

---

#### Mark Notification as Read

**Event:** `notification:markAsRead`

**Emit:**

```javascript
socket.emit("notification:markAsRead", {
  notificationId: "507f1f77bcf86cd799439016",
});
```

**Listen:**

```javascript
socket.on("notification:markAsRead", (notification) => {
  console.log("Notification marked as read:", notification);
});
```

---

#### Mark All Notifications as Read

**Event:** `notification:markAllAsRead`

**Emit:**

```javascript
socket.emit("notification:markAllAsRead", {
  recipient: "507f1f77bcf86cd799439011",
});
```

**Listen:**

```javascript
socket.on("notification:markAllAsRead", (result) => {
  console.log("All notifications marked as read");
});
```

---

#### Notification Error

**Event:** `notification:error`

**Listen:**

```javascript
socket.on("notification:error", (data) => {
  console.error("Notification error:", data.message);
});
```

---

## 🔒 Security

This API implements multiple security measures:

- **Helmet**: Sets secure HTTP headers
- **CORS**: Configurable cross-origin resource sharing
- **MongoDB Sanitization**: Prevents NoSQL injection attacks
- **JWT Authentication**: Secure token-based authentication
- **Bcrypt**: Password hashing with salt rounds
- **Joi Validation**: Input validation for all requests
- **Rate Limiting**: (Recommended to add for production)
- **File Upload Validation**: Multer with file type and size restrictions

### Best Practices

1. **Always use HTTPS in production**
2. **Keep JWT secrets secure and complex**
3. **Set appropriate token expiration times**
4. **Implement rate limiting**
5. **Validate and sanitize all user inputs**
6. **Use environment variables for sensitive data**

---

## ⚠️ Error Handling

The API uses a centralized error handling system with standardized error responses.

### Error Response Format

```json
{
  "success": false,
  "error": "Error message here",
  "statusCode": 400
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

### Example Error Responses

**Validation Error (400):**

```json
{
  "success": false,
  "error": "Username must be at least 3 characters"
}
```

**Authentication Error (401):**

```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

**Not Found Error (404):**

```json
{
  "success": false,
  "error": "Post not found"
}
```

---

## 🧪 Testing

### Using Postman

Import the included Postman collection:

1. Open Postman
2. Click **Import**
3. Select `Social-Media-API.postman_collection.json`
4. Import environment: `Social-Media-API.postman_environment.json`

The collection includes:

- All API endpoints with example requests
- Automatic token management
- Pre-configured environment variables

### Using cURL

**Register:**

```bash
curl -X POST http://localhost:5000/api/v2/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Login:**

```bash
curl -X POST http://localhost:5000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Get Profile (with token):**

```bash
curl -X GET http://localhost:5000/api/v2/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 📝 License

ISC

---

## 👨‍💻 Author

Your Name - [GitHub Profile](https://github.com/yourusername)

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📞 Support

For support, email yousashrafef1247@example.com or open an issue in the repository.

---

**Built with ❤️ using Node.js, Express, MongoDB, and Socket.io**
