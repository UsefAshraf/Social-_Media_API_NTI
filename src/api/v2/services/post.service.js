const User = require('../../../shared/models/User');
const { removeUpload } = require('../../../shared/utils/files');

// Delete a post with its image and remove it from everyone's bookmarks
const deletePost = async (post) => {
  await post.deleteOne();
  await removeUpload(post.image);
  await removeUpload(post.thumbnail);
  await User.updateMany({ bookmarks: post._id }, { $pull: { bookmarks: post._id } });
};

// Delete a comment and its replies, then save the post
const deleteComment = async (post, commentId) => {
  post.comments.pull(
    ...post.comments.filter((c) => c._id.equals(commentId) || (c.parentId && c.parentId.equals(commentId)))
  );
  await post.save();
};

module.exports = {
  deletePost,
  deleteComment,
};
