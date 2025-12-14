const asyncHandler = require('../../../shared/utils/asyncHandler');
const { response } = require('../../../shared/utils/response');
const authService = require('../services/auth.service');

// const register = asyncHandler(async (req, res) => {
//   const result = await authService.register(req.body);

//   res.status(201).json({
//     success: true,
//     data: result,
//   });
// });

async function register(req,res) {
  //register service
  const result = await authService.register(req.body)
  //response
  response(res,result)


}
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
};
