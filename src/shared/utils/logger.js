const pino = require('pino');

const hasPretty = () => {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
};

const isTest = process.env.NODE_ENV === 'test';
const pretty = process.env.NODE_ENV === 'development' && hasPretty();

const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  ...(pretty && {
    transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } },
  }),
});

// short info-level activity message, kept for existing callers
const log = (message) => logger.info(message);

module.exports = { logger, log };
