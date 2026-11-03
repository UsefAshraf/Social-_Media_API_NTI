const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { protect } = require('../../../shared/middleware/auth');

router.get('/', protect, notificationController.getNotifications);

router.patch('/read-all', protect, notificationController.markAllAsRead);

router.patch('/:id/read', protect, notificationController.markAsRead);

router.delete('/:id', protect, notificationController.deleteNotification);

module.exports = router;
