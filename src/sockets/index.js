const socketIO = require("socket.io");
const { verifyAccessToken } = require("../shared/utils/tokens");
const { chatHandler } = require("./chatHandler");
const { notificationHandler } = require("./notificationHandler");

// const initializeSocketIO = (server) => {
//     const io = socketIO(server, {
//         cors: {
//             origin: process.env.ALLOWED_ORIGINS || "*",
//             methods: ["GET", "POST"],
//             credentials: true,
//         },
//     });

//     //Auth middleware
//     io.use((socket, next) => {
//         try {
//             const token = socket.handshake.auth?.token ||
//               socket.handshake.headers.authorization?.split(" ")[1];

//             if (!token) {
//                 return next(new Error("Auth Error: token not provided"))
//             }

//             const decoded = verifyAccessToken(token)
//             socket.userId = decoded.userId
//             next()
//         } catch (error) {
//             next(new Error("Auth error: Invalid token"))
//         }
//     })

//     io.on("connection", (socket) => {
//         console.log(`User connected ${socket.userId}`)
//         socket.join(socket.userId.toString())

//         //call chat handler
//         chatHandler(io,socket)

//         socket.on("disconnect", () => {
//             console.log(`User disconnected ${socket.userId}`)
//         })
//         socket.on("error", (error) => {
//             console.log(`Socket error: ${error}`)
//         })
//     })

//     return io
// }

// module.exports = initializeSocketIO

const initializeSocketIO = (server) => {
    const onlineUsers = new Set();
    const io = socketIO(server, {
        cors: {
            origin: process.env.ALLOWED_ORIGINS || "*",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    // Auth middleware
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token ||
                          socket.handshake.headers.authorization?.split(" ")[1];

            if (!token) {
                return next(new Error("Auth Error: token not provided"));
            }

            const decoded = verifyAccessToken(token);
            socket.userId = decoded.userId;
            next();
        } catch (error) {
            next(new Error("Auth error: Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        onlineUsers.add(socket.userId.toString());
        console.log(`User connected ${socket.userId}`);
        socket.join(socket.userId.toString());

        // Call chat handler
        chatHandler(io, socket);
        notificationHandler(io, socket,onlineUsers);

        socket.on("disconnect", () => {
            onlineUsers.delete(socket.userId.toString());
            console.log(`User disconnected ${socket.userId}`);
        });

        socket.on("error", (error) => {
            console.log(`Socket error: ${error}`);
        });
    });

    return io;
}

module.exports = initializeSocketIO;