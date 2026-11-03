const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const validate = require('../../../shared/middleware/validate');
const { registerSchema, loginSchema } = require('../validators/auth.validator');
const { protect } = require('../../../shared/middleware/auth');
const { authLimiter } = require('../../../shared/middleware/rateLimiter');

router.post('/register', authLimiter, validate(registerSchema), authController.register);

router.post('/login', authLimiter, validate(loginSchema), authController.login);

router.post('/refresh', authLimiter, authController.refresh);

router.post('/logout', protect, authController.logout);

router.get("/reset", authLimiter, authController.requestResetPassword)

router.post("/reset", authLimiter, authController.submitNewPassword)

module.exports = router;
