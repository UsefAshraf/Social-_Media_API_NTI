const User = require('../../../shared/models/User');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiError = require('../../../shared/utils/ApiError');

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
  const { username, email, avatar } = req.body;

  const updateData = {};
  if (username) updateData.username = username;
  if (email) updateData.email = email;
  if (avatar !== undefined) updateData.avatar = avatar;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    {
      new: true,
      runValidators: true,
    }
  ).select('-password -refreshToken');

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

  await User.updateOne({ _id: req.user._id }, { $addToSet: { following: target._id } });
  await User.updateOne({ _id: target._id }, { $addToSet: { followers: req.user._id } });

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

module.exports = {
  getProfile,
  updateProfile,
  followUser,
  unfollowUser,
};
