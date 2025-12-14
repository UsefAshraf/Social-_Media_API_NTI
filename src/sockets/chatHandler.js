const { createRoom, createMessage } = require("../api/v2/services/message.service")

const chatHandler = (io,socket) => {
    // join
    socket.on("chat:join", async(data) => {
        try{
            const { userId } = data
            const room = await createRoom(socket.userId, userId)
            socket.join(room)
            console.log(`User ${socket.userId} joined room ${room}`);
            socket.emit("chat:joined", { room,userId })
        }catch(error){
            console.log(error)
            socket.emit("chat:error", { message:"Failed to join room",error })
        }
    })

    // send message
    socket.on("chat:message", async(data) => {
        try{
            socket.emit("chat:message", { message:data })
            const { receiverId,content } = data;
            if(!receiverId || !content){
                throw socket.emit("chat:error", { message:"Invalid data nothinggggggg" })
            }
            //create room
            const room = await createRoom(socket.userId, receiverId);
            //create message
            const newMessage = await createMessage(socket.userId, receiverId, content, room);
            //emit message to both users
            io.to(room).emit("chat:message", { message:newMessage })
            console.log(`User ${socket.userId} sent message to ${receiverId}`);

        }catch(error){
            console.log(error)
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
            console.log(error)
            socket.emit("chat:error", { message:"Failed to send typing indicator",error })
        }
    })
    // leave
    socket.on("chat:leave", async(data) => {
        try{
            socket.leave(data.userId.toString())
            console.log(`User ${socket.userId} left room ${data.userId}`);
        }catch(error){
            console.log(error)
            socket.emit("chat:error", { message:"Failed to leave room",error })
        }
    })
}


module.exports = {
    chatHandler
}