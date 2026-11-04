const Redis = require('ioredis');

let client = null;
let closing = false;
const clients = [];

const connect = () => {
  closing = false;
  const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
  // connections being shut down can report resets; ignore those
  redis.on('error', (error) => closing || console.error('Redis error:', error.message));
  clients.push(redis);
  return redis;
};

// Shared Redis connection, or null when REDIS_URL is not set (single-instance mode)
const getRedis = () => {
  if (!process.env.REDIS_URL) return null;
  if (!client) client = connect();
  return client;
};

// Extra dedicated connection, e.g. for pub/sub
const createRedisClient = () => (process.env.REDIS_URL ? connect() : null);

const closeRedis = async () => {
  closing = true;
  await Promise.all(clients.splice(0).map((c) => c.quit().catch(() => c.disconnect())));
  client = null;
};

module.exports = {
  getRedis,
  createRedisClient,
  closeRedis,
};
