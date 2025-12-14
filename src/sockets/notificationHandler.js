const notificationService = require("../api/v2/services/notification.service");

exports.notificationHandler = async (io, socket, onlineUsers) => {
  socket.on("notification:notify", async (data) => {
    try {
      const { recipient, type, content, link, relatedId } = data;
      const senderId = socket.userId;

      const isOnline = onlineUsers.has(recipient.toString());
      console.log(`Recipient ${recipient} online status: ${isOnline}`);

      const notificationData = {
        recipient,
        sender: senderId,
        type,
        content,
        link,
        relatedId,
      };

      let notification;

      if (isOnline) {
        console.log(
          "Recipient is online. Saving to DB and emitting real-time."
        );

        notification = await notificationService.createNotification(
          notificationData
        );
        io.to(recipient.toString()).emit("notification:new", notification);
      } else {
        console.log("Recipient is offline. Saving to DB only.");
        notification = await notificationService.createNotification(
          notificationData
        );
      }
    } catch (error) {
      console.log(error);
      socket.emit("notification:error", {
        message: "Failed to send notification",
        error,
      });
    }
  });

  socket.on("notification:markAsRead", async (data) => {
    try {
      const { notificationId } = data;
      console.log(notificationId);
      const userId = socket.userId;
      const notification = await notificationService.markNotificationAsRead(
        notificationId,
        userId
      );
      socket.emit("notification:markAsRead", notification);
    } catch {
      console.log(error);
      socket.emit("notification:error", {
        message: "Failed to mark notification as read",
        error,
      });
    }
  });

  socket.on("notification:markAllAsRead", async (data) => {
    try {
      const { recipient } = data;
      const notification = await notificationService.markAllNotificationsAsRead(
        recipient
      );
      socket.emit("notification:markAllAsRead", notification);
    } catch {
      console.log(error);
      socket.emit("notification:error", {
        message: "Failed to mark all notifications as read",
        error,
      });
    }
  });
};

//search how to use socket.io client in the frontend
