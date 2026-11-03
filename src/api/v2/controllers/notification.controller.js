const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiError = require('../../../shared/utils/ApiError');
const notificationService = require('../services/notification.service');

const getNotifications = asyncHandler(async (req, res) => {
  const { notifications, total, unreadCount, page, limit } =
    await notificationService.getUserNotifications(req.user._id, req.query);

  res.status(200).json({
    success: true,
    data: notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationAsRead(req.params.id, req.user._id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  res.status(200).json({
    success: true,
    data: notification,
  });
});

const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllNotificationsAsRead(req.user._id);

  res.status(200).json({
    success: true,
    data: { updated: result.modifiedCount },
  });
});

const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await notificationService.deleteNotification(req.params.id, req.user._id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  res.status(200).json({
    success: true,
    message: 'Notification deleted',
  });
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
