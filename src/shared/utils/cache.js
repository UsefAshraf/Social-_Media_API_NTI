const { getRedis } = require('../config/redis');
const { logger } = require('./logger');

// Return the cached JSON value for `key`, or compute it and cache it for ttlSeconds.
// Cache errors never fail the request; without Redis this just calls compute().
const cached = async (key, ttlSeconds, compute) => {
  const redis = getRedis();
  if (!redis) return compute();

  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit);
  } catch (error) {
    logger.warn({ err: error, key }, 'Cache read failed');
  }

  const value = await compute();
  redis.set(key, JSON.stringify(value), 'EX', ttlSeconds).catch((error) => logger.warn({ err: error, key }, 'Cache write failed'));
  return value;
};

module.exports = { cached };
