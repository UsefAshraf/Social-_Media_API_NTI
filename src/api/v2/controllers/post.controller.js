const Post = require('../../../shared/models/Post');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiError = require('../../../shared/utils/ApiError');

const createPost = asyncHandler(async (req, res) => {
  const { content, image } = req.body;

  const post = await Post.create({
    content,
    image: image || '',
    author: req.user._id,
  });

  await post.populate('author', 'username avatar');

  res.status(201).json({
    success: true,
    data: post,
  });
});

const getPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const posts = await Post.find()
    .populate('author', 'username avatar')
    .populate('comments.author', 'username avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Post.countDocuments();

  res.status(200).json({
    success: true,
    data: posts,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
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

  const { content, image } = req.body;

  if (content) post.content = content;
  if (image !== undefined) post.image = image;

  await post.save();
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

  if (likeIndex === -1) {
    post.likes.push(req.user._id);
  } else {
    post.likes.splice(likeIndex, 1);
  }

  await post.save();
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
  getPost,
  updatePost,
  deletePost,
  likePost,
  addComment,
  deleteComment,
};
