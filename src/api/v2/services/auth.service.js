const User = require('../../../shared/models/User');
const ApiError = require('../../../shared/utils/ApiError');
const crypto = require("crypto")
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../../../shared/utils/tokens');
const emailService = require('./email.service');
const { sendWelcomeEmail, sendResetEmail } = emailService;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex")

const VERIFY_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Issue a fresh verification token and email it; replaces any previous token
const sendVerification = async (user) => {
  const token = crypto.randomBytes(32).toString("hex")
  user.verifyToken = hashToken(token)
  user.verifyTokenExpiration = Date.now() + VERIFY_TOKEN_TTL
  await user.save()
  await emailService.sendVerificationEmail(user.email, user.username, token)
}

const register = async (userData) => {
  const { username, email, password } = userData;

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    if (existingUser.email === email) {
      throw new ApiError(400, 'Email already exists');
    }
    if (existingUser.username === username) {
      throw new ApiError(400, 'Username already exists');
    }
  }

  const user = await User.create({
    username,
    email,
    password,
  });

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save();
  await sendWelcomeEmail(user.username, user.email)
  await sendVerification(user)

  return {
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
    },
    accessToken,
    refreshToken,
  };
};

const login = async (email, password) => {
  const user = await User.findOne({ email }).select('+password +refreshToken');

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (user.banned) {
    throw new ApiError(403, 'This account has been suspended');
  }

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save();

  return {
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
    },
    accessToken,
    refreshToken,
  };
};

const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new ApiError(401, 'Refresh token is required');
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    // // {
    // userId : "232323232"
    // email: "dsadsad@g"
    // // }
    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save();

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
};

const resetPassword = async (email) => {
  let foundedUser = await User.findOne({ email })
  // don't reveal whether the email exists
  if (!foundedUser) return

  const token = crypto.randomBytes(32).toString("hex")
  foundedUser.resetToken = hashToken(token)
  foundedUser.resetTokenExpiration = Date.now() + 18000000 //5 hours in miliseconds
  let savedUser = await foundedUser.save()
  await sendResetEmail(savedUser.email, savedUser.username, token)
}

const submitNewPassword = async (token, newPassword) => {

  let user = await User.findOne({
    resetToken: hashToken(String(token)),
    resetTokenExpiration: { $gt: Date.now() }
  })

  if (!user) {
    throw new ApiError(400, 'Invalid or expired token');
  }

  user.password = newPassword
  user.resetToken = null
  user.resetTokenExpiration = null
  return await user.save()
}


const verifyEmail = async (token) => {
  const user = await User.findOne({
    verifyToken: hashToken(String(token)),
    verifyTokenExpiration: { $gt: Date.now() },
  })

  if (!user) {
    throw new ApiError(400, 'Invalid or expired verification token');
  }

  user.emailVerified = true
  user.verifyToken = undefined
  user.verifyTokenExpiration = undefined
  await user.save()
}

const resendVerification = async (userId) => {
  const user = await User.findById(userId)
  if (user.emailVerified) {
    throw new ApiError(400, 'Email is already verified');
  }
  await sendVerification(user)
}

const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  resetPassword,
  submitNewPassword,
  verifyEmail,
  resendVerification,
};
