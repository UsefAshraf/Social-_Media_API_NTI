const User = require("../shared/models/User");

// userId -> number of open sockets (a user can have several tabs/devices)
const connections = new Map();

const setStatus = async (io, userId, status) => {
    const lastSeen = new Date();
    await User.updateOne({ _id: userId }, { status, lastSeen });
    io.emit("presence:update", { userId, status, lastSeen });
};

// Users left "online" by a crash or restart are reset on startup
const resetPresence = () => User.updateMany({ status: "online" }, { status: "offline" });

const isOnline = (userId) => connections.has(userId.toString());

const presenceHandler = async (io, socket) => {
    const userId = socket.userId.toString();
    const count = (connections.get(userId) || 0) + 1;
    connections.set(userId, count);

    // data: { userIds: [...] } -> [{ userId, status, lastSeen }]
    socket.on("presence:query", async (data, ack) => {
        try {
            const users = await User.find({ _id: { $in: data?.userIds || [] } }).select("status lastSeen");
            const result = users.map((u) => ({
                userId: u._id.toString(),
                status: isOnline(u._id) ? "online" : "offline",
                lastSeen: u.lastSeen,
            }));
            if (typeof ack === "function") ack(result);
            else socket.emit("presence:query", result);
        } catch (error) {
            console.log(error);
            socket.emit("presence:error", { message: "Failed to load presence" });
        }
    });

    socket.on("disconnect", async () => {
        const remaining = (connections.get(userId) || 1) - 1;
        if (remaining > 0) {
            connections.set(userId, remaining);
            return;
        }
        connections.delete(userId);
        await setStatus(io, userId, "offline").catch((error) => console.log(error));
    });

    // listeners are registered first so nothing is missed while this saves
    if (count === 1) {
        await setStatus(io, userId, "online").catch((error) => console.log(error));
    }
};

module.exports = {
    presenceHandler,
    resetPresence,
    isOnline,
};
