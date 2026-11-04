const { Worker } = require('bullmq');
const { QUEUE_PREFIX, queueConnection, getQueue } = require('../shared/queue/queues');
const emailService = require('../api/v2/services/email.service');
const imageService = require('../api/v2/services/image.service');
const notificationService = require('../api/v2/services/notification.service');
const { log, logger } = require('../shared/utils/logger');

const processors = {
  email: (job) => emailService.deliverEmail(job.data),
  images: (job) => imageService.processImage(job.data),
  maintenance: (job) => {
    if (job.name === 'cleanup-notifications') return notificationService.cleanupNotifications();
    throw new Error(`Unknown maintenance job ${job.name}`);
  },
};

const concurrency = { email: 5, images: 2, maintenance: 1 };

const startWorkers = async () => {
  const workers = Object.entries(processors).map(([name, processor]) => {
    const worker = new Worker(name, processor, {
      connection: queueConnection(),
      prefix: QUEUE_PREFIX,
      concurrency: concurrency[name],
    });
    worker.on('completed', (job) => log(`${name} job ${job.id} completed`));
    worker.on('failed', (job, error) => logger.error({ err: error, queue: name, jobId: job?.id, attempts: job?.attemptsMade }, 'Job failed'));
    return worker;
  });

  // every night at 03:00; repeatable jobs are de-duplicated by their pattern
  await getQueue('maintenance').add('cleanup-notifications', {}, { repeat: { pattern: '0 3 * * *' }, removeOnComplete: 10 });

  return workers;
};

const stopWorkers = (workers) => Promise.all(workers.map((w) => w.close()));

module.exports = {
  startWorkers,
  stopWorkers,
};
