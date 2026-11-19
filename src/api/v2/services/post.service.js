const User = require('../../../shared/models/User');
const { removeUpload } = require('../../../shared/utils/files');

// Populate applied to every post payload so all endpoints return the same shape
const POST_POPULATE = [
  { path: 'author', select: 'username avatar' },
  { path: 'comments.author', select: 'username avatar' },
  { path: 'mentions', select: 'username' },
];

// Same output res.json() would produce for a document; lean/aggregate objects pass through
const toPlain = (post) => (post && typeof post.toJSON === 'function' ? post.toJSON() : post);

// Adds per-viewer state (`bookmarked`) and `commentCount` to one post or an array of posts.
// Does a single bookmark lookup; pass `bookmarks` when the caller already has them.
const withViewerState = async (posts, viewerId, { bookmarks } = {}) => {
  const list = Array.isArray(posts) ? posts : [posts];
  if (!bookmarks) {
    const me = list.length && viewerId
      ? await User.findById(viewerId).select('+bookmarks').lean()
      : null;
    bookmarks = (me && me.bookmarks) || [];
  }
  const saved = new Set(bookmarks.map(String));

  const out = list.map((post) => {
    const plain = toPlain(post);
    if (!plain) return plain;
    const commentCount = Array.isArray(plain.comments) ? plain.comments.length : plain.commentCount ?? 0;
    return { ...plain, commentCount, bookmarked: saved.has(String(plain._id)) };
  });
  return Array.isArray(posts) ? out : out[0];
};

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
  POST_POPULATE,
  withViewerState,
  deletePost,
  deleteComment,
};
