const User = require('../../../shared/models/User');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiError = require('../../../shared/utils/ApiError');
const { fileUrl, removeUpload } = require('../../../shared/utils/files');
const { notify } = require('../services/notification.service');

const getProfile = asyncHandler(async (req, res) => {
  const userId = req.params.id || req.user._id;

  const user = await User.findById(userId).select('-password -refreshToken');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { username, email } = req.body;
  const avatar = fileUrl(req.file) ?? req.body.avatar;

  const updateData = {};
  if (username) updateData.username = username;
  if (email) updateData.email = email;
  if (avatar !== undefined) updateData.avatar = avatar;

  const previous = await User.findById(req.user._id).select('avatar');

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    {
      new: true,
      runValidators: true,
    }
  ).select('-password -refreshToken');

  if (avatar !== undefined && previous.avatar !== user.avatar) {
    await removeUpload(previous.avatar);
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

const followUser = asyncHandler(async (req, res) => {
  const targetId = req.params.id;

  if (targetId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot follow yourself");
  }

  const target = await User.findById(targetId);
  if (!target) {
    throw new ApiError(404, "User not found");
  }

  const { modifiedCount } = await User.updateOne(
    { _id: req.user._id, following: { $ne: target._id } },
    { $addToSet: { following: target._id } }
  );
  await User.updateOne({ _id: target._id }, { $addToSet: { followers: req.user._id } });

  // only notify on a new follow, not a repeated request
  if (modifiedCount) {
    await notify(req.app.get("io"), {
      recipient: target._id,
      sender: req.user._id,
      type: "follow",
      content: `${req.user.username} started following you`,
      link: `/users/${req.user._id}`,
    });
  }

  res.status(200).json({
    success: true,
    message: `You are now following ${target.username}`,
  });
});

const unfollowUser = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) {
    throw new ApiError(404, "User not found");
  }

  await User.updateOne({ _id: req.user._id }, { $pull: { following: target._id } });
  await User.updateOne({ _id: target._id }, { $pull: { followers: req.user._id } });

  res.status(200).json({
    success: true,
    message: `You unfollowed ${target.username}`,
  });
});

const listConnections = (field) =>
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
      .select(field)
      .populate(field, "username avatar");

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    res.status(200).json({
      success: true,
      count: user[field].length,
      data: user[field],
    });
  });

const getFollowers = listConnections("followers");
const getFollowing = listConnections("following");

const blockUser = asyncHandler(async (req, res) => {
  const me = req.user._id;

  if (req.params.id === me.toString()) {
    throw new ApiError(400, "You cannot block yourself");
  }

  const target = await User.findById(req.params.id).select("_id username");
  if (!target) {
    throw new ApiError(404, "User not found");
  }

  await User.updateOne(
    { _id: me },
    { $addToSet: { blocked: target._id }, $pull: { following: target._id, followers: target._id } }
  );
  await User.updateOne({ _id: target._id }, { $pull: { following: me, followers: me } });

  res.status(200).json({
    success: true,
    message: `You blocked ${target.username}`,
  });
});

const unblockUser = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { blocked: req.params.id } });

  res.status(200).json({
    success: true,
    message: "User unblocked",
  });
});

const getBlocked = asyncHandler(async (req, res) => {
  const me = await User.findById(req.user._id).select("+blocked").populate("blocked", "username avatar");

  res.status(200).json({
    success: true,
    count: me.blocked.length,
    data: me.blocked,
  });
});

module.exports = {
  blockUser,
  unblockUser,
  getBlocked,
  getProfile,
  getFollowers,
  getFollowing,
  updateProfile,
  followUser,
  unfollowUser,
};
