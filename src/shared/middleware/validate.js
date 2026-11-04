const ApiError = require('../utils/ApiError');

// source: which part of the request to validate ('body' or 'query')
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[source], { abortEarly: false });

    if (error) {
      const message = error.details.map((detail) => detail.message).join(', ');
      throw new ApiError(400, message);
    }

    next();
  };
};

module.exports = validate;
