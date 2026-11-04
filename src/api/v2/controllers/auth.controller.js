const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiError = require('../../../shared/utils/ApiError');
const authService = require('../services/auth.service');

const REFRESH_COOKIE = 'refreshToken';

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/v2/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const setRefreshCookie = (res, token) => res.cookie(REFRESH_COOKIE, token, refreshCookieOptions);

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  setRefreshCookie(res, result.refreshToken);

  res.status(201).json({
    success: true,
    data: result,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  setRefreshCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    data: result,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  const result = await authService.refreshAccessToken(refreshToken);
  setRefreshCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    data: result,
  });
});

const requestResetPassword = asyncHandler(async (req, res) => {
  const email = req.query.email || req.body?.email
  if (!email) {
    throw new ApiError(400, 'Email is required')
  }
  await authService.resetPassword(email)
  res.status(200).json({
    success: true,
    // data: result
    message: "Please check your mail"
  })
})

const submitNewPassword = async (req, res) => {
  try {
    let { token, newPassword } = req.body
    await authService.submitNewPassword(token, newPassword)

    res.status(200).json({
      success: true,
      message: "password reset successfully"
    }
    )
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Invalid or expired token"
    })
  }
}

const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);

  res.status(200).json({
    success: true,
    message: 'Email verified',
  });
});

const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Verification email sent',
  });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions, maxAge: undefined });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  requestResetPassword,
  submitNewPassword,
  verifyEmail,
  resendVerification,
};
