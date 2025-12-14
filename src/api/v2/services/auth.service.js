const User = require('../../../shared/models/User');
const ApiError = require('../../../shared/utils/ApiError');
const crypto = require("crypto")
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../../../shared/utils/tokens');
const { sendWelcomeEmail, sendResetEmail } = require('./email.service');

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

  return {
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
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

    console.log(user)

    if (!user || user.refreshToken !== refreshToken) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    const newAccessToken = generateAccessToken(user._id);

    //sadsaf;lsdaj;fgljdasg;ljad;slgjka;ldskg;laksd;glkasd;lgk;sldkg;sldakg;lasd

    return { accessToken: newAccessToken };
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
};

const resetPassword = async (email) => {
  try {
    // let { email } = req.body
    let foundedUser = await User.findOne({ email })
    if (!foundedUser) {
      console.log("user not found")
      throw Error("not found")
    }
    crypto.randomBytes(32, async (err, buffer) => {
      const token = buffer.toString("hex");
      foundedUser.resetToken = token
      foundedUser.resetTokenExpiration = Date.now() + 18000000 //5 hours in miliseconds
      let savedUser = await foundedUser.save()
      await sendResetEmail(savedUser.email, savedUser.username, token)
    })

  } catch (error) {

  }
}

const submitNewPassword = async (token, newPassword) => {

  let user = await User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() }
  })

  // let date = Date.now()

  console.log(date)
  if (!user) {
    throw new ApiError(400, 'Invalid or expired token');
  }

  user.password = newPassword
  user.resetToken = null
  user.resetTokenExpiration = null
  return await user.save()
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
  submitNewPassword
};
