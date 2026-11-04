// Standalone worker process: npm run worker
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./shared/config/db");
const { startWorkers, stopWorkers } = require("./workers");
const { closeQueues } = require("./shared/queue/queues");
const { closeRedis } = require("./shared/config/redis");
const { logger } = require("./shared/utils/logger");

if (!process.env.REDIS_URL) {
  logger.fatal("REDIS_URL is required to run workers");
  process.exit(1);
}

(async () => {
  await connectDB();
  const workers = await startWorkers();
  logger.info("Workers running: email, images, maintenance");

  const shutdown = async (signal) => {
    logger.info({ signal }, "Stopping workers");
    await stopWorkers(workers);
    await closeQueues();
    await Promise.all([mongoose.connection.close(), closeRedis()]);
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})();
