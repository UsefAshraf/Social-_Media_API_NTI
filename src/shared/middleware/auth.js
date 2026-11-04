const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokens');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401, 'Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (error) {
    throw new ApiError(401, 'Not authorized, token failed');
  }

  req.user = await User.findById(decoded.userId).select('-password -refreshToken');

  if (!req.user) {
    throw new ApiError(401, 'User not found');
  }

  if (req.user.banned) {
    throw new ApiError(403, 'This account has been suspended');
  }

  next();
});

// Use after protect: authorize('admin')
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    throw new ApiError(403, 'You do not have permission to do this');
  }
  next();
};

module.exports = { protect, authorize };
