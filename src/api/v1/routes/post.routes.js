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

router.post('/', protect, validate(createPostSchema), postController.createPost);

router.get('/', protect, postController.getPosts);

router.get('/:id', protect, postController.getPost);

router.patch('/:id', protect, validate(updatePostSchema), postController.updatePost);

router.delete('/:id', protect, postController.deletePost);

router.post('/:id/like', protect, postController.likePost);

router.post('/:id/comments', protect, validate(createCommentSchema), postController.addComment);

router.delete('/:id/comments/:commentId', protect, postController.deleteComment);

module.exports = router;
