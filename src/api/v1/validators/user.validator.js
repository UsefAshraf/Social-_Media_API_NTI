const Joi = require('joi');

const updateProfileSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(30)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .optional()
    .messages({
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username cannot exceed 30 characters',
      'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
    }),
  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Please provide a valid email',
    }),
  avatar: Joi.string()
    .uri()
    .allow('')
    .optional()
    .messages({
      'string.uri': 'Avatar must be a valid URL',
    }),
});

module.exports = {
  updateProfileSchema,
};
