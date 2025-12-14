const asyncHandler = require('../../../shared/utils/asyncHandler');
const authService = require('../services/auth.service');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);

  res.status(201).json({
    success: true,
    data: result,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  res.status(200).json({
    success: true,
    data: result,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authService.refreshAccessToken(refreshToken);

  res.status(200).json({
    success: true,
    data: result,
  });
});

const requestResetPassword = async (req, res) => {
  let { email } = req.body
  let result = await authService.resetPassword(email)
  res.status(200).json({
    success: true,
    // data: result
    message: "Please check your mail"
  })
}

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

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);

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
  submitNewPassword
};
