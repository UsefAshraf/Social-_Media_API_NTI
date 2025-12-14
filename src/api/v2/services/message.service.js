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
// exports.getMessages = async (room) => {
//     try {
//         const messages = await Message.find({ room })
//         return messages
//     } catch (error) {
//         throw error
//     }


// }

