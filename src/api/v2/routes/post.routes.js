const express = require('express');
const router = express.Router();
const postController = require('../controllers/post.controller');
const validate = require('../../../shared/middleware/validate');
const {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
} = require('../validators/post.validator');
const { protect } = require('../../../shared/middleware/auth');
const { requireVerified } = require('../../../shared/middleware/requireVerified');
const trendingController = require('../controllers/trending.controller');

router.post('/', protect, requireVerified, validate(createPostSchema), postController.createPost);

router.get('/', protect, postController.getPosts);

router.get('/feed', protect, postController.getFeed);

router.get('/bookmarks', protect, postController.getBookmarks);

router.get('/trending', protect, trendingController.getTrendingPosts);

router.get('/user/:userId', protect, postController.getUserPosts);

router.get('/hashtag/:tag', protect, postController.getPostsByHashtag);

router.get('/:id', protect, postController.getPost);

router.patch('/:id', protect, validate(updatePostSchema), postController.updatePost);

router.delete('/:id', protect, postController.deletePost);

router.post('/:id/like', protect, postController.likePost);

router.post('/:id/bookmark', protect, postController.bookmarkPost);

router.delete('/:id/bookmark', protect, postController.unbookmarkPost);

router.post('/:id/comments', protect, requireVerified, validate(createCommentSchema), postController.addComment);

router.post('/:id/comments/:commentId/like', protect, postController.likeComment);

router.delete('/:id/comments/:commentId', protect, postController.deleteComment);

module.exports = router;
