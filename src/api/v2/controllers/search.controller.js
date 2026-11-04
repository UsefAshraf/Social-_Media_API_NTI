const asyncHandler = require('../../../shared/utils/asyncHandler');
const searchService = require('../services/search.service');

const search = asyncHandler(async (req, res) => {
  const { q, type, limit } = req.query;
  const data = await searchService.search(q, { type, limit });

  res.status(200).json({
    success: true,
    data,
  });
});

module.exports = { search };
