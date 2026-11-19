const Post = require('../../../shared/models/Post');
const User = require('../../../shared/models/User');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiError = require('../../../shared/utils/ApiError');
const { fileUrl, removeUpload } = require('../../../shared/utils/files');
const { notify } = require('../services/notification.service');
const { resolveMentions, notifyMentions } = require('../services/mention.service');
const { hiddenUserIds, isBlockedBetween } = require('../services/block.service');
const postService = require('../services/post.service');
const { listPosts } = require('../services/feed.service');
const { POST_POPULATE, withViewerState } = postService;
const { handleUpload } = require('../services/image.service');

const assertNotBlocked = async (userId, post) => {
  if (await isBlockedBetween(userId, post.author)) {
    throw new ApiError(403, 'You cannot interact with this post');
  }
};
const { parsePagination, paginationMeta } = require('../../../shared/utils/pagination');

const createPost = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const uploaded = fileUrl(req.file);
  const image = uploaded || req.body.image;

  const mentioned = await resolveMentions(content);

  const post = await Post.create({
    content,
    image: image || '',
    author: req.user._id,
    mentions: mentioned.map((u) => u._id),
  });

  await notifyMentions(req.app.get('io'), mentioned, { sender: req.user, where: 'post', post });
  if (uploaded) Object.assign(post, await handleUpload('post', post, uploaded));

  await post.populate(POST_POPULATE);

  res.status(201).json({
    success: true,
    data: await withViewerState(post, req.user._id),
  });
});

const getPosts = asyncHandler(async (req, res) => {
  const filter = { author: { $nin: await hiddenUserIds(req.user._id) } };

  res.status(200).json({
    success: true,
    ...(await listPosts(filter, req.query, { viewerId: req.user._id })),
  });
});

const getFeed = asyncHandler(async (req, res) => {
  const me = await User.findById(req.user._id).select("following");
  const filter = { author: { $in: [...me.following, req.user._id] } };

  res.status(200).json({
    success: true,
    ...(await listPosts(filter, req.query, { viewerId: req.user._id })),
  });
});

const getUserPosts = asyncHandler(async (req, res) => {
  const filter = { author: req.params.userId };

  if (await isBlockedBetween(req.user._id, req.params.userId)) {
    throw new ApiError(404, 'User not found');
  }

  res.status(200).json({
    success: true,
    ...(await listPosts(filter, req.query, { viewerId: req.user._id })),
  });
});

const getPostsByHashtag = asyncHandler(async (req, res) => {
  const filter = {
    hashtags: req.params.tag.replace(/^#/, '').toLowerCase(),
    author: { $nin: await hiddenUserIds(req.user._id) },
  };

  res.status(200).json({
    success: true,
    ...(await listPosts(filter, req.query, { viewerId: req.user._id })),
  });
});

const getPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id).populate(POST_POPULATE);

  if (!post || (await isBlockedBetween(req.user._id, post.author._id))) {
    throw new ApiError(404, 'Post not found');
  }

  res.status(200).json({
    success: true,
    data: await withViewerState(post, req.user._id),
  });
});

const updatePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  if (post.author.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to update this post');
  }

  const { content } = req.body;
  const uploaded = fileUrl(req.file);
  const image = uploaded ?? req.body.image;

  let newlyMentioned = [];
  if (content) {
    const mentioned = await resolveMentions(content);
    const previous = new Set(post.mentions.map(String));
    newlyMentioned = mentioned.filter((u) => !previous.has(u._id.toString()));
    post.content = content;
    post.mentions = mentioned.map((u) => u._id);
  }
  if (image !== undefined && image !== post.image) {
    await removeUpload(post.image);
    await removeUpload(post.thumbnail);
    post.image = image;
    post.thumbnail = '';
  }

  await post.save();
  await notifyMentions(req.app.get('io'), newlyMentioned, { sender: req.user, where: 'post', post });
  if (uploaded) Object.assign(post, await handleUpload('post', post, uploaded));
  await post.populate(POST_POPULATE);

  res.status(200).json({
    success: true,
    data: await withViewerState(post, req.user._id),
  });
});

const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  if (post.author.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to delete this post');
  }

  await postService.deletePost(post);

  res.status(200).json({
    success: true,
    message: 'Post deleted successfully',
  });
});

const likePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  await assertNotBlocked(req.user._id, post);

  const likeIndex = post.likes.indexOf(req.user._id);

  const liked = likeIndex === -1;
  if (liked) {
    post.likes.push(req.user._id);
  } else {
    post.likes.splice(likeIndex, 1);
  }

  await post.save();

  if (liked) {
    await notify(req.app.get('io'), {
      recipient: post.author,
      sender: req.user._id,
      type: 'like',
      content: `${req.user.username} liked your post`,
      link: `/posts/${post._id}`,
      relatedId: post._id,
    });
  }
  await post.populate(POST_POPULATE);

  res.status(200).json({
    success: true,
    data: await withViewerState(post, req.user._id),
  });
});

const addComment = asyncHandler(async (req, res) => {
  const { content, parentId } = req.body;

  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  await assertNotBlocked(req.user._id, post);

  let parent = null;
  if (parentId) {
    parent = post.comments.id(parentId);
    if (!parent) {
      throw new ApiError(404, 'Parent comment not found');
    }
    // keep threads one level deep
    if (parent.parentId) parent = post.comments.id(parent.parentId);
  }

  post.comments.push({
    author: req.user._id,
    content,
    parentId: parent ? parent._id : null,
  });

  await post.save();

  if (parent) {
    await notify(req.app.get('io'), {
      recipient: parent.author,
      sender: req.user._id,
      type: 'comment',
      content: `${req.user.username} replied: ${content.slice(0, 100)}`,
      link: `/posts/${post._id}`,
      relatedId: post._id,
    });
  }

  await notify(req.app.get('io'), {
    recipient: post.author,
    sender: req.user._id,
    type: 'comment',
    content: `${req.user.username} commented: ${content.slice(0, 100)}`,
    link: `/posts/${post._id}`,
    relatedId: post._id,
  });

  // the post author already got a comment notification
  const mentioned = (await resolveMentions(content)).filter((u) => !u._id.equals(post.author));
  await notifyMentions(req.app.get('io'), mentioned, { sender: req.user, where: 'comment', post });

  await post.populate(POST_POPULATE);

  res.status(201).json({
    success: true,
    data: await withViewerState(post, req.user._id),
  });
});

const likeComment = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  const comment = post.comments.id(req.params.commentId);
  if (!comment) {
    throw new ApiError(404, 'Comment not found');
  }

  const liked = !comment.likes.some((id) => id.equals(req.user._id));
  if (liked) comment.likes.push(req.user._id);
  else comment.likes.pull(req.user._id);

  await post.save();

  if (liked) {
    await notify(req.app.get('io'), {
      recipient: comment.author,
      sender: req.user._id,
      type: 'like',
      content: `${req.user.username} liked your comment`,
      link: `/posts/${post._id}`,
      relatedId: post._id,
    });
  }

  res.status(200).json({
    success: true,
    data: { liked, likes: comment.likes.length },
  });
});

const deleteComment = asyncHandler(async (req, res) => {
  const { id: postId, commentId } = req.params;

  const post = await Post.findById(postId);

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  const comment = post.comments.id(commentId);

  if (!comment) {
    throw new ApiError(404, 'Comment not found');
  }

  if (comment.author.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to delete this comment');
  }

  await postService.deleteComment(post, comment._id);

  res.status(200).json({
    success: true,
    message: 'Comment deleted successfully',
  });
});

const getBookmarks = asyncHandler(async (req, res) => {
  const paging = parsePagination(req.query);
  const me = await User.findById(req.user._id).select('+bookmarks');

  // bookmarks are appended, so the newest saves are at the end
  const ids = [...me.bookmarks].reverse();
  const pageIds = ids.slice(paging.skip, paging.skip + paging.limit);

  const posts = await Post.find({ _id: { $in: pageIds } }).populate(POST_POPULATE).lean();
  const byId = new Map(posts.map((p) => [p._id.toString(), p]));
  const page = pageIds.map((id) => byId.get(id.toString())).filter(Boolean);

  res.status(200).json({
    success: true,
    data: await withViewerState(page, req.user._id, { bookmarks: me.bookmarks }),
    pagination: paginationMeta(paging, ids.length),
  });
});

const bookmarkPost = asyncHandler(async (req, res) => {
  const post = await Post.exists({ _id: req.params.id });
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  await User.updateOne({ _id: req.user._id }, { $addToSet: { bookmarks: post._id } });

  res.status(200).json({
    success: true,
    message: 'Post saved',
  });
});

const unbookmarkPost = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { bookmarks: req.params.id } });

  res.status(200).json({
    success: true,
    message: 'Post removed from saved',
  });
});

module.exports = {
  createPost,
  getBookmarks,
  bookmarkPost,
  unbookmarkPost,
  getPosts,
  getFeed,
  getUserPosts,
  getPostsByHashtag,
  getPost,
  updatePost,
  deletePost,
  likePost,
  addComment,
  likeComment,
  deleteComment,
};
