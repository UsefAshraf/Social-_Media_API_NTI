const { Queue } = require('bullmq');
const { createRedisClient } = require('../config/redis');

const QUEUE_PREFIX = 'smapi';
const queues = {};

// BullMQ requires connections that retry forever
const queueConnection = () => createRedisClient({ maxRetriesPerRequest: null });

// The named queue, or null when Redis is not configured
const getQueue = (name) => {
  if (!process.env.REDIS_URL) return null;
  if (!queues[name]) queues[name] = new Queue(name, { connection: queueConnection(), prefix: QUEUE_PREFIX });
  return queues[name];
};

const closeQueues = async () => {
  await Promise.all(Object.values(queues).map((q) => q.close()));
  Object.keys(queues).forEach((name) => delete queues[name]);
};

module.exports = {
  QUEUE_PREFIX,
  queueConnection,
  getQueue,
  closeQueues,
};
