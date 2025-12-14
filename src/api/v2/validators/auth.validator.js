const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(30)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username cannot exceed 30 characters',
      'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
      'any.required': 'Username is required',
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email',
      'any.required': 'Email is required',
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required',
    }),
});

// const loginSchema = Joi.object({
//   email: Joi.string()
//     .email()
//     .required()
//     .messages({
//       'string.email': 'Please provide a valid email',
//       'any.required': 'Email is required',
//     }),
//   password: Joi.string()
//     .required()
//     .messages({
//       'any.required': 'Password is required',
//     }),
// });


const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email' : 'Please provide valid email',
    'required' : "email is required"
  }),
  password: Joi.string().required().messages({
    'required': "password is required"
  })
})

module.exports = {
  registerSchema,
  loginSchema,
};
