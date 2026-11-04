const ApiError = require('../utils/ApiError');

// Blocks unverified users when REQUIRE_EMAIL_VERIFICATION=true (read per request)
const requireVerified = (req, res, next) => {
  if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !req.user.emailVerified) {
    throw new ApiError(403, 'Please verify your email first');
  }
  next();
};

module.exports = { requireVerified };
