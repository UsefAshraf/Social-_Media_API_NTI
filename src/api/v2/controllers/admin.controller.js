const Report = require('../../../shared/models/Report');
const Post = require('../../../shared/models/Post');
const User = require('../../../shared/models/User');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiError = require('../../../shared/utils/ApiError');
const { parsePagination, paginationMeta } = require('../../../shared/utils/pagination');
const postService = require('../services/post.service');
const { findTargetAuthor } = require('../services/report.service');
const { cached } = require('../../../shared/utils/cache');

const setBanned = async (userId, banned) => {
  const user = await User.findById(userId).select('username role banned');
  if (!user) throw new ApiError(404, 'User not found');
  if (banned && user.role === 'admin') throw new ApiError(400, 'Admins cannot be banned');

  user.banned = banned;
  await user.save();
  // banning also ends the user's sessions
  if (banned) await User.updateOne({ _id: user._id }, { refreshToken: null, status: 'offline' });
  return user;
};

const deleteReportedContent = async (report) => {
  if (report.targetType === 'post') {
    const post = await Post.findById(report.targetId);
    if (post) await postService.deletePost(post);
  } else if (report.targetType === 'comment') {
    const post = await Post.findById(report.post);
    if (post && post.comments.id(report.targetId)) await postService.deleteComment(post, report.targetId);
  } else {
    throw new ApiError(400, 'Use ban_user for user reports');
  }
};

const getReports = asyncHandler(async (req, res) => {
  const paging = parsePagination(req.query, { defaultLimit: 20 });
  const filter = { status: req.query.status || 'open' };

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .populate('reporter', 'username avatar')
      .populate('resolvedBy', 'username')
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit),
    Report.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: reports,
    pagination: paginationMeta(paging, total),
  });
});

const resolveReport = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) {
    throw new ApiError(404, 'Report not found');
  }
  if (report.status !== 'open') {
    throw new ApiError(400, 'Report is already closed');
  }

  const { status, action = 'none' } = req.body;

  if (status === 'resolved' && action === 'ban_user') {
    const author = await findTargetAuthor({ targetType: report.targetType, targetId: report.targetId, postId: report.post });
    if (!author) throw new ApiError(404, 'Reported content no longer exists');
    await setBanned(author, true);
  } else if (status === 'resolved' && action === 'delete_content') {
    await deleteReportedContent(report);
  }

  report.status = status;
  report.action = status === 'resolved' ? action : 'none';
  report.resolvedBy = req.user._id;
  report.resolvedAt = new Date();
  await report.save();

  res.status(200).json({
    success: true,
    data: report,
  });
});

const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  await postService.deletePost(post);

  res.status(200).json({
    success: true,
    message: 'Post deleted',
  });
});

const banUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(400, 'You cannot ban yourself');
  }

  const user = await setBanned(req.params.id, req.body.banned);

  res.status(200).json({
    success: true,
    data: user,
  });
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await cached('admin:stats', 30, async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [users, bannedUsers, onlineUsers, posts, postsToday, openReports] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ banned: true }),
      User.countDocuments({ status: 'online' }),
      Post.countDocuments(),
      Post.countDocuments({ createdAt: { $gte: since } }),
      Report.countDocuments({ status: 'open' }),
    ]);
    return { users, bannedUsers, onlineUsers, posts, postsToday, openReports };
  });

  res.status(200).json({
    success: true,
    data: stats,
  });
});

module.exports = {
  getReports,
  resolveReport,
  deletePost,
  banUser,
  getStats,
};
