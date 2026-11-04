const ApiError = require('../utils/ApiError');
const { fileUrl, removeUpload } = require('../utils/files');
const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // a failed request should not leave its uploaded file behind
  if (req.file) removeUpload(fileUrl(req.file));

  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new ApiError(404, message);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    error = new ApiError(400, message);
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    error = new ApiError(400, message);
  }

  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5MB or smaller' : err.message;
    error = new ApiError(400, message);
  }

  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new ApiError(401, message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new ApiError(401, message);
  }

  if (error.statusCode >= 500) {
    (req.log || logger).error({ err }, 'Unhandled error');
  }

  res.status(error.statusCode).json({
    success: false,
    error: error.message || 'Server Error',
    requestId: req.id,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
