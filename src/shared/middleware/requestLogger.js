const { randomUUID } = require('crypto');
const pinoHttp = require('pino-http');
const { logger } = require('../utils/logger');

// accept a caller-provided id only if it cannot break log lines
const SAFE_ID = /^[\w.-]{1,128}$/;

const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id = SAFE_ID.test(incoming || '') ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/metrics' },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

module.exports = { requestLogger };
