const { getRedis } = require('../config/redis');

// Return the cached JSON value for `key`, or compute it and cache it for ttlSeconds.
// Cache errors never fail the request; without Redis this just calls compute().
const cached = async (key, ttlSeconds, compute) => {
  const redis = getRedis();
  if (!redis) return compute();

  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit);
  } catch (error) {
    console.error('Cache read failed:', error.message);
  }

  const value = await compute();
  redis.set(key, JSON.stringify(value), 'EX', ttlSeconds).catch((error) => console.error('Cache write failed:', error.message));
  return value;
};

module.exports = { cached };
