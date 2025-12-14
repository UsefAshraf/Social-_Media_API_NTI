const Notification = require("../../../shared/models/Notification");


exports.createNotification = async (notificationData) => {
    try {
        console.log("notification created");
        
        const notification = await Notification.create(notificationData);
        console.log(notification);
        
        await notification.populate([
            { path: "sender", select: "username avatar email" },
            { path: "recipient", select: "username avatar email" },
            { path: "relatedId", select: "image content" },
        ]);
        console.log(notification);
        
        return notification;
    } catch (error) {
        console.log(error);
        throw error;
    }
}
exports.getUserNotifications = async (recipient) => {
    try {
        const notifications = await Notification.find({ recipient }).sort({ createdAt: -1 });
        return notifications;
    } catch (error) {
        console.log(error);
        throw error;
    }
}
exports.deleteNotification = async (notificationId) => {
    try {
        const notification = await Notification.findByIdAndDelete(notificationId);
        return notification;
    } catch (error) {
        console.log(error);
        throw error;
    }
}
exports.markNotificationAsRead = async (notificationId,sender) => {
    try {
        const notification = await Notification.findById(notificationId);
        if(notification.recipient.toString() !== sender){
            console.log("Unauthorized");
            // throw new Error("Unauthorized");
        }
        console.log("Notification marked as read");
        
        await notification.updateOne({ read: true });
        return notification;
    } catch (error) {
        console.log(error);
        throw error;
    }
}
exports.markAllNotificationsAsRead = async (recipient) => {
    try {
        const notifications = await Notification.updateMany({ recipient }, { read: true });
        return notifications;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

