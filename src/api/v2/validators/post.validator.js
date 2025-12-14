const Joi = require('joi');

const createPostSchema = Joi.object({
  content: Joi.string()
    .max(1000)
    .required()
    .messages({
      'string.max': 'Post content cannot exceed 1000 characters',
      'any.required': 'Post content is required',
    }),
  image: Joi.string()
    .uri()
    .allow('')
    .optional()
    .messages({
      'string.uri': 'Image must be a valid URL',
    }),
});

const updatePostSchema = Joi.object({
  content: Joi.string()
    .max(1000)
    .optional()
    .messages({
      'string.max': 'Post content cannot exceed 1000 characters',
    }),
  image: Joi.string()
    .uri()
    .allow('')
    .optional()
    .messages({
      'string.uri': 'Image must be a valid URL',
    }),
});

const createCommentSchema = Joi.object({
  content: Joi.string()
    .max(500)
    .required()
    .messages({
      'string.max': 'Comment cannot exceed 500 characters',
      'any.required': 'Comment content is required',
    }),
});

module.exports = {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
};
