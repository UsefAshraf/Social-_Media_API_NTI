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

module.exports = {
  getProfile,
  updateProfile,
};
