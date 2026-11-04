const Report = require('../../../shared/models/Report');
const Post = require('../../../shared/models/Post');
const User = require('../../../shared/models/User');
const ApiError = require('../../../shared/utils/ApiError');

// Make sure the reported thing exists; returns the id of its author
const findTargetAuthor = async ({ targetType, targetId, postId }) => {
  if (targetType === 'user') {
    const user = await User.exists({ _id: targetId });
    return user && user._id;
  }

  const post = await Post.findById(targetType === 'post' ? targetId : postId).select('author comments');
  if (!post) return null;
  if (targetType === 'post') return post.author;

  const comment = post.comments.id(targetId);
  return comment && comment.author;
};

const createReport = async (reporterId, { targetType, targetId, postId, reason, details }) => {
  const author = await findTargetAuthor({ targetType, targetId, postId });
  if (!author) {
    throw new ApiError(404, `Reported ${targetType} not found`);
  }
  if (author.equals(reporterId)) {
    throw new ApiError(400, 'You cannot report yourself');
  }

  try {
    return await Report.create({
      reporter: reporterId,
      targetType,
      targetId,
      post: targetType === 'comment' ? postId : null,
      reason,
      details,
    });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'You have already reported this');
    throw error;
  }
};

module.exports = {
  findTargetAuthor,
  createReport,
};
