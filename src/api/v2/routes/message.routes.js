const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { protect } = require('../../../shared/middleware/auth');

router.get('/conversations', protect, messageController.getConversations);

router.get('/:userId', protect, messageController.getMessages);

router.patch('/:userId/read', protect, messageController.markAsRead);

module.exports = router;
