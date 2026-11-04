const socketIO = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createRedisClient } = require("../shared/config/redis");
const { verifyAccessToken } = require("../shared/utils/tokens");
const User = require("../shared/models/User");
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

    const pubClient = createRedisClient();
    if (pubClient) {
        io.adapter(createAdapter(pubClient, createRedisClient()));
    }

    // Auth middleware
    io.use(async (socket, next) => {
        let decoded;
        try {
            const token = socket.handshake.auth?.token ||
                          socket.handshake.headers.authorization?.split(" ")[1];

            if (!token) {
                return next(new Error("Auth Error: token not provided"));
            }

            decoded = verifyAccessToken(token);
        } catch (error) {
            return next(new Error("Auth error: Invalid token"));
        }

        const user = await User.findById(decoded.userId).select("banned").catch(() => null);
        if (!user || user.banned) {
            return next(new Error("Auth error: Account unavailable"));
        }

        socket.userId = decoded.userId;
        // socket.data is visible to other instances via fetchSockets()
        socket.data.userId = decoded.userId;
        next();
    });

    // with several instances sharing Redis, one restarting must not mark everyone offline
    if (!pubClient) resetPresence().catch((error) => console.log(error));

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