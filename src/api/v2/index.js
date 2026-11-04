const express = require('express');
const router = express.Router();

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const postRoutes = require('./routes/post.routes');
const messageRoutes = require('./routes/message.routes');
const notificationRoutes = require('./routes/notification.routes');
const searchRoutes = require('./routes/search.routes');
const reportRoutes = require('./routes/report.routes');
const adminRoutes = require('./routes/admin.routes');
const hashtagRoutes = require('./routes/hashtag.routes');

// index of the API, for anyone opening /api/v2 directly
router.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'Social Media API',
    version: 'v2',
    docs: '/api-docs',
    health: '/health',
    resources: ['/auth', '/users', '/posts', '/messages', '/notifications', '/search', '/hashtags', '/reports', '/admin'],
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/posts', postRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/search', searchRoutes);
router.use('/reports', reportRoutes);
router.use('/admin', adminRoutes);
router.use('/hashtags', hashtagRoutes);

module.exports = router;
