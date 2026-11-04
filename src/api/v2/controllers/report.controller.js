const asyncHandler = require('../../../shared/utils/asyncHandler');
const reportService = require('../services/report.service');

const createReport = asyncHandler(async (req, res) => {
  const report = await reportService.createReport(req.user._id, req.body);

  res.status(201).json({
    success: true,
    message: 'Thanks, our moderators will review this',
    data: { id: report._id, status: report.status },
  });
});

module.exports = { createReport };
