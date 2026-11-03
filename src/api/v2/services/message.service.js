const mongoose = require("mongoose")
const Message = require("../../../shared/models/Message")



exports.createMessage = async (senderId, receiverId, content, room) => {
    try {
        const newMessage = await Message.create({ sender:senderId, receiver:receiverId, content, room });
        await newMessage.populate([
            { path: "sender", select: "username avatar email" },
            { path: "receiver", select: "username avatar email" },
        ]);
        return newMessage
    } catch (error) {
        throw error
    }
}

// exports.createRoom = async (userId1, userId2) => {
//     try {
//         return [userId1, userId2].sort().join("_")
//     } catch (error) {
//         throw error
//     }
// }

exports.createRoom = async (userId1, userId2) => { // <-- Marked as async
    try {
        return [userId1, userId2].sort().join("_") // <-- Returns a String wrapped in a Promise
    } catch (error) {
        throw error
    }
}
// Newest-first page of a room; pass the oldest createdAt you have as `before` to load older messages
exports.getMessages = async (room, { before, limit = 30 } = {}) => {
    const filter = { room }
    if (before) filter.createdAt = { $lt: new Date(before) }

    const messages = await Message.find(filter)
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) || 30, 100))
        .populate([
            { path: "sender", select: "username avatar" },
            { path: "receiver", select: "username avatar" },
        ])

    return messages
}

// One entry per conversation with its latest message and my unread count
exports.getConversations = async (userId) => {
    const me = new mongoose.Types.ObjectId(userId)

    const conversations = await Message.aggregate([
        { $match: { $or: [{ sender: me }, { receiver: me }] } },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: "$room",
                lastMessage: { $first: "$$ROOT" },
                unreadCount: {
                    $sum: { $cond: [{ $and: [{ $eq: ["$receiver", me] }, { $eq: ["$read", false] }] }, 1, 0] },
                },
            },
        },
        { $sort: { "lastMessage.createdAt": -1 } },
    ])

    // populate the raw message docs, which match the Message schema
    await Message.populate(conversations.map((c) => c.lastMessage), [
        { path: "sender", select: "username avatar" },
        { path: "receiver", select: "username avatar" },
    ])

    return conversations.map(({ _id, lastMessage, unreadCount }) => ({
        room: _id,
        user: lastMessage.sender._id.equals(me) ? lastMessage.receiver : lastMessage.sender,
        lastMessage,
        unreadCount,
    }))
}

exports.markAsRead = async (room, readerId) => {
    const result = await Message.updateMany(
        { room, receiver: readerId, read: false },
        { read: true }
    )
    return result.modifiedCount
}

