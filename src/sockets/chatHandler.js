const { createRoom, createMessage } = require("../api/v2/services/message.service")
const { isBlockedBetween } = require("../api/v2/services/block.service")
const { log, logger } = require("../shared/utils/logger")

const chatHandler = (io,socket) => {
    // join
    socket.on("chat:join", async(data) => {
        try{
            const { userId } = data
            const room = await createRoom(socket.userId, userId)
            socket.join(room)
            log(`User ${socket.userId} joined room ${room}`);
            socket.emit("chat:joined", { room,userId })
        }catch(error){
            logger.error({ err: error, userId: socket.userId }, "chat:join failed")
            socket.emit("chat:error", { message:"Failed to join room",error })
        }
    })

    // send message
    socket.on("chat:message", async(data) => {
        try{
            const { receiverId,content } = data;
            if(!receiverId || !content){
                return socket.emit("chat:error", { message:"receiverId and content are required" })
            }
            if(await isBlockedBetween(socket.userId, receiverId)){
                return socket.emit("chat:error", { message:"You cannot message this user" })
            }
            //create room
            const room = await createRoom(socket.userId, receiverId);
            //create message
            const newMessage = await createMessage(socket.userId, receiverId, content, room);
            //emit to the chat room and the receiver's personal room, so they get it even with the chat closed
            io.to(room).to(receiverId.toString()).emit("chat:message", { message:newMessage })
            log(`User ${socket.userId} sent message to ${receiverId}`);

        }catch(error){
            logger.error({ err: error, userId: socket.userId }, "chat:message failed")
            socket.emit("chat:error", { message:"Failed to send message",error })
        }
    })

    //typing indicator
    socket.on("chat:typing", async(data) => {
        try{
            const { receiverId , isTyping } = data;
            const room = await createRoom(socket.userId, receiverId);

            socket.to(room).emit("chat:typing", { userId:socket.userId , isTyping })
        }catch(error){
            logger.error({ err: error, userId: socket.userId }, "chat:typing failed")
            socket.emit("chat:error", { message:"Failed to send typing indicator",error })
        }
    })
    // leave
    socket.on("chat:leave", async(data) => {
        try{
            const room = await createRoom(socket.userId, data.userId)
            socket.leave(room)
            log(`User ${socket.userId} left room ${room}`);
        }catch(error){
            logger.error({ err: error, userId: socket.userId }, "chat:leave failed")
            socket.emit("chat:error", { message:"Failed to leave room",error })
        }
    })
}


module.exports = {
    chatHandler
}