const socketIO = require("socket.io");
const { verifyAccessToken } = require("../shared/utils/tokens");
const { chatHandler } = require("./chatHandler");
const { notificationHandler } = require("./notificationHandler");
const { presenceHandler, resetPresence } = require("./presenceHandler");
const { log } = require("../shared/utils/logger");

const initializeSocketIO = (server) => {
    const io = socketIO(server, {
        cors: {
            origin: process.env.ALLOWED_ORIGINS?.split(",") || "http://localhost:3000",
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

    resetPresence().catch((error) => console.log(error));

    io.on("connection", (socket) => {
        log(`User connected ${socket.userId}`);
        socket.join(socket.userId.toString());

        // Call chat handler
        chatHandler(io, socket);
        notificationHandler(io, socket);
        presenceHandler(io, socket);

        socket.on("disconnect", () => {
            log(`User disconnected ${socket.userId}`);
        });

        socket.on("error", (error) => {
            console.log(`Socket error: ${error}`);
        });
    });

    return io;
}

module.exports = initializeSocketIO;