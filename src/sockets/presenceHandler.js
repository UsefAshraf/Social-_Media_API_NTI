const User = require("../shared/models/User");
const { logger } = require("../shared/utils/logger");

const setStatus = async (io, userId, status) => {
    const lastSeen = new Date();
    await User.updateOne({ _id: userId }, { status, lastSeen });
    io.emit("presence:update", { userId, status, lastSeen });
};

// Users left "online" by a crash or restart are reset on startup
const resetPresence = () => User.updateMany({ status: "online" }, { status: "offline" });

// Each socket joins a room named after its user, on whichever instance it is connected to
const onlineUserIds = async (io, userIds) => {
    if (!userIds.length) return new Set();
    const sockets = await io.in(userIds.map(String)).fetchSockets();
    return new Set(sockets.map((s) => s.data.userId));
};

const presenceHandler = async (io, socket) => {
    const userId = socket.userId.toString();

    // data: { userIds: [...] } -> [{ userId, status, lastSeen }]
    socket.on("presence:query", async (data, ack) => {
        try {
            const ids = data?.userIds || [];
            const [users, online] = await Promise.all([
                User.find({ _id: { $in: ids } }).select("lastSeen"),
                onlineUserIds(io, ids),
            ]);
            const result = users.map((u) => ({
                userId: u._id.toString(),
                status: online.has(u._id.toString()) ? "online" : "offline",
                lastSeen: u.lastSeen,
            }));
            if (typeof ack === "function") ack(result);
            else socket.emit("presence:query", result);
        } catch (error) {
            logger.error({ err: error, userId }, "presence:query failed");
            socket.emit("presence:error", { message: "Failed to load presence" });
        }
    });

    // the socket has already left its rooms here, so only other tabs/devices remain
    socket.on("disconnect", async () => {
        try {
            const remaining = await io.in(userId).fetchSockets();
            if (!remaining.length) await setStatus(io, userId, "offline");
        } catch (error) {
            logger.error({ err: error, userId }, "Failed to update presence on disconnect");
        }
    });

    // first connection of this user anywhere: they just came online
    try {
        const sockets = await io.in(userId).fetchSockets();
        if (sockets.length === 1) await setStatus(io, userId, "online");
    } catch (error) {
        logger.error({ err: error, userId }, "Failed to update presence on connect");
    }
};

module.exports = {
    presenceHandler,
    resetPresence,
    onlineUserIds,
};
