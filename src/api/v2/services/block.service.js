const User = require('../../../shared/models/User');

// Users hidden from `userId`: everyone they blocked and everyone who blocked them
const hiddenUserIds = async (userId) => {
  const [me, blockers] = await Promise.all([
    User.findById(userId).select('+blocked'),
    User.find({ blocked: userId }).select('_id'),
  ]);
  return [...(me?.blocked || []), ...blockers.map((u) => u._id)];
};

// True if either user has blocked the other
const isBlockedBetween = async (a, b) =>
  Boolean(await User.exists({ $or: [{ _id: a, blocked: b }, { _id: b, blocked: a }] }));

module.exports = {
  hiddenUserIds,
  isBlockedBetween,
};
