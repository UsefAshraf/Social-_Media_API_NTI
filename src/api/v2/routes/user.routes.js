const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const validate = require('../../../shared/middleware/validate');
const { updateProfileSchema } = require('../validators/user.validator');
const { protect } = require('../../../shared/middleware/auth');

router.get('/profile', protect, userController.getProfile);

router.get('/:id', protect, userController.getProfile);

router.get('/:id/followers', protect, userController.getFollowers);

router.get('/:id/following', protect, userController.getFollowing);

router.post('/:id/follow', protect, userController.followUser);

router.delete('/:id/follow', protect, userController.unfollowUser);

router.patch('/profile', protect, validate(updateProfileSchema), userController.updateProfile);

module.exports = router;
