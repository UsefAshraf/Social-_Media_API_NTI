const express = require('express');
const router = express.Router();
const trendingController = require('../controllers/trending.controller');
const { protect } = require('../../../shared/middleware/auth');

router.get('/trending', protect, trendingController.getTrendingHashtags);

module.exports = router;
