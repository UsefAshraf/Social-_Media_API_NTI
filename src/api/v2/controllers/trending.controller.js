const asyncHandler = require('../../../shared/utils/asyncHandler');
const trendingService = require('../services/trending.service');
const { hiddenUserIds } = require('../services/block.service');

const getTrendingPosts = asyncHandler(async (req, res) => {
  const { hours, limit } = req.query;
  const posts = await trendingService.trendingPosts({ hours, limit, hidden: await hiddenUserIds(req.user._id) });

  res.status(200).json({
    success: true,
    data: posts,
  });
});

const getTrendingHashtags = asyncHandler(async (req, res) => {
  const { hours, limit } = req.query;

  res.status(200).json({
    success: true,
    data: await trendingService.trendingHashtags({ hours, limit }),
  });
});

module.exports = {
  getTrendingPosts,
  getTrendingHashtags,
};
