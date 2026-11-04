const Notification = require("../../../shared/models/Notification");
const { isBlockedBetween } = require("./block.service");

const populateFields = [
    { path: "sender", select: "username avatar" },
    { path: "relatedId", select: "image content" },
];

exports.createNotification = async (notificationData) => {
    const notification = await Notification.create(notificationData);
    await notification.populate(populateFields);
    return notification;
}

// Save a notification and push it live to the recipient's personal socket room.
// Never throws: a failed notification must not fail the action that triggered it.
exports.notify = async (io, { recipient, sender, type, content, link = null, relatedId = null }) => {
    if (recipient.toString() === sender.toString()) return null;

    try {
        if (await isBlockedBetween(recipient, sender)) return null;

        const notification = await exports.createNotification({ recipient, sender, type, content, link, relatedId });
        if (io) io.to(recipient.toString()).emit("notification:new", notification);
        return notification;
    } catch (error) {
        console.error("Failed to create notification", error);
        return null;
    }
}

exports.getUserNotifications = async (recipient, { page = 1, limit = 20 } = {}) => {
    limit = Math.min(Number(limit) || 20, 100);
    page = Math.max(Number(page) || 1, 1);

    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find({ recipient })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate(populateFields),
        Notification.countDocuments({ recipient }),
        Notification.countDocuments({ recipient, read: false }),
    ]);

    return { notifications, total, unreadCount, page, limit };
}

exports.deleteNotification = async (notificationId, recipient) => {
    return Notification.findOneAndDelete({ _id: notificationId, recipient });
}

exports.markNotificationAsRead = async (notificationId, recipient) => {
    return Notification.findOneAndUpdate(
        { _id: notificationId, recipient },
        { read: true },
        { new: true }
    );
}

exports.markAllNotificationsAsRead = async (recipient) => {
    return Notification.updateMany({ recipient, read: false }, { read: true });
}
