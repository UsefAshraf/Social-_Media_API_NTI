const Post = require('../../../shared/models/Post');
const User = require('../../../shared/models/User');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiError = require('../../../shared/utils/ApiError');
const { fileUrl, removeUpload } = require('../../../shared/utils/files');
const { notify } = require('../services/notification.service');
const { resolveMentions, notifyMentions } = require('../services/mention.service');
const { parsePagination, paginationMeta } = require('../../../shared/utils/pagination');

const createPost = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const image = fileUrl(req.file) || req.body.image;

  const mentioned = await resolveMentions(content);

  const post = await Post.create({
    content,
    image: image || '',
    author: req.user._id,
    mentions: mentioned.map((u) => u._id),
  });

  await notifyMentions(req.app.get('io'), mentioned, { sender: req.user, where: 'post', post });

  await post.populate('author', 'username avatar');

  res.status(201).json({
    success: true,
    data: post,
  });
});

const getPosts = asyncHandler(async (req, res) => {
  const paging = parsePagination(req.query);

  const posts = await Post.find()
    .populate('author', 'username avatar')
    .populate('comments.author', 'username avatar')
    .sort({ createdAt: -1 })
    .skip(paging.skip)
    .limit(paging.limit);

  const total = await Post.countDocuments();

  res.status(200).json({
    success: true,
    data: posts,
    pagination: paginationMeta(paging, total),
  });
});

const getFeed = asyncHandler(async (req, res) => {
  const paging = parsePagination(req.query);

  const me = await User.findById(req.user._id).select("following");
  const filter = { author: { $in: [...me.following, req.user._id] } };

  const posts = await Post.find(filter)
    .populate("author", "username avatar")
    .populate("comments.author", "username avatar")
    .sort({ createdAt: -1 })
    .skip(paging.skip)
    .limit(paging.limit);

  const total = await Post.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: posts,
    pagination: paginationMeta(paging, total),
  });
});

const getUserPosts = asyncHandler(async (req, res) => {
  const paging = parsePagination(req.query);
  const filter = { author: req.params.userId };

  const posts = await Post.find(filter)
    .populate("author", "username avatar")
    .sort({ createdAt: -1 })
    .skip(paging.skip)
    .limit(paging.limit);

  const total = await Post.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: posts,
    pagination: paginationMeta(paging, total),
  });
});

const getPostsByHashtag = asyncHandler(async (req, res) => {
  const paging = parsePagination(req.query);
  const filter = { hashtags: req.params.tag.replace(/^#/, '').toLowerCase() };

  const posts = await Post.find(filter)
    .populate('author', 'username avatar')
    .sort({ createdAt: -1 })
    .skip(paging.skip)
    .limit(paging.limit);

  const total = await Post.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: posts,
    pagination: paginationMeta(paging, total),
  });
});

const getPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id)
    .populate('author', 'username avatar')
    .populate('comments.author', 'username avatar');

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  res.status(200).json({
    success: true,
    data: post,
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
  const image = fileUrl(req.file) ?? req.body.image;

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
    post.image = image;
  }

  await post.save();
  await notifyMentions(req.app.get('io'), newlyMentioned, { sender: req.user, where: 'post', post });
  await post.populate('author', 'username avatar');

  res.status(200).json({
    success: true,
    data: post,
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

  await post.deleteOne();
  await removeUpload(post.image);

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
  await post.populate('author', 'username avatar');

  res.status(200).json({
    success: true,
    data: post,
  });
});

const addComment = asyncHandler(async (req, res) => {
  const { content } = req.body;

  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  post.comments.push({
    author: req.user._id,
    content,
  });

  await post.save();

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

  await post.populate('author', 'username avatar');
  await post.populate('comments.author', 'username avatar');

  res.status(201).json({
    success: true,
    data: post,
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

  comment.deleteOne();
  await post.save();

  res.status(200).json({
    success: true,
    message: 'Comment deleted successfully',
  });
});

module.exports = {
  createPost,
  getPosts,
  getFeed,
  getUserPosts,
  getPostsByHashtag,
  getPost,
  updatePost,
  deletePost,
  likePost,
  addComment,
  deleteComment,
};
