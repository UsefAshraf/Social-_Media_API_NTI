const notificationService = require("../api/v2/services/notification.service");

// Notifications are created server-side (likes, comments, follows) and pushed
// as "notification:new". Clients can only update their own notifications here.
exports.notificationHandler = (io, socket) => {
  socket.on("notification:markAsRead", async (data) => {
    try {
      const notification = await notificationService.markNotificationAsRead(
        data?.notificationId,
        socket.userId
      );
      if (!notification) {
        return socket.emit("notification:error", { message: "Notification not found" });
      }
      socket.emit("notification:markAsRead", notification);
    } catch (error) {
      console.log(error);
      socket.emit("notification:error", {
        message: "Failed to mark notification as read",
      });
    }
  });

  socket.on("notification:markAllAsRead", async () => {
    try {
      const result = await notificationService.markAllNotificationsAsRead(socket.userId);
      socket.emit("notification:markAllAsRead", { updated: result.modifiedCount });
    } catch (error) {
      console.log(error);
      socket.emit("notification:error", {
        message: "Failed to mark all notifications as read",
      });
    }
  });
};
