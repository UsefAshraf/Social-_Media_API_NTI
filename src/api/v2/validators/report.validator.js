const Joi = require('joi');
const { REASONS } = require('../../../shared/models/Report');

const objectId = Joi.string().hex().length(24);

const createReportSchema = Joi.object({
  targetType: Joi.string().valid('post', 'comment', 'user').required(),
  targetId: objectId.required(),
  postId: objectId.when('targetType', {
    is: 'comment',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  reason: Joi.string()
    .valid(...REASONS)
    .required(),
  details: Joi.string().max(500).allow(''),
});

const resolveReportSchema = Joi.object({
  status: Joi.string().valid('resolved', 'dismissed').required(),
  action: Joi.string().valid('none', 'delete_content', 'ban_user').default('none'),
});

const banUserSchema = Joi.object({
  banned: Joi.boolean().required(),
});

module.exports = {
  createReportSchema,
  resolveReportSchema,
  banUserSchema,
};
