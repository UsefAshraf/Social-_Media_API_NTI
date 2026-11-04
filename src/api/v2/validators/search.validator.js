const Joi = require('joi');

const searchQuerySchema = Joi.object({
  q: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Search query q is required',
    'string.empty': 'Search query q is required',
  }),
  type: Joi.string().valid('all', 'users', 'posts', 'hashtags').default('all'),
  limit: Joi.number().integer().min(1).max(50),
});

module.exports = { searchQuerySchema };
