const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const validate = require('../../../shared/middleware/validate');
const { registerSchema, loginSchema } = require('../validators/auth.validator');
const { protect } = require('../../../shared/middleware/auth');

router.post('/register', validate(registerSchema), authController.register);

router.post('/login', validate(loginSchema), authController.login);

router.post('/refresh', authController.refresh);

router.post('/logout', protect, authController.logout);

router.get("/reset", authController.requestResetPassword)

router.post("/reset", authController.submitNewPassword)

module.exports = router;
