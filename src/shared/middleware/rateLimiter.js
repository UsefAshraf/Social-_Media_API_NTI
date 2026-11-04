const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis } = require('../config/redis');

const redis = getRedis();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  // in-memory store unless Redis is configured
  ...(redis && {
    store: new RedisStore({ sendCommand: (...args) => redis.call(...args), prefix: 'rl:auth:' }),
  }),
  message: {
    success: false,
    error: 'Too many attempts, please try again later',
  },
});

module.exports = { authLimiter };
