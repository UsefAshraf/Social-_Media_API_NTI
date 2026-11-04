const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'smapi_' });

const httpDuration = new client.Histogram({
  name: 'smapi_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const socketConnections = new client.Gauge({
  name: 'smapi_socket_connections',
  help: 'Open Socket.IO connections on this instance',
  registers: [register],
});

// Route templates (/api/v2/posts/:id) keep label cardinality low.
// Express resets req.baseUrl when an error bubbles out of a router, so the full
// template is captured at the moment Express assigns req.route.
const captureRouteTemplate = (req) => {
  let route;
  Object.defineProperty(req, 'route', {
    configurable: true,
    enumerable: true,
    get: () => route,
    set: (value) => {
      route = value;
      if (value) req.routeTemplate = req.baseUrl + value.path;
    },
  });
};

const metricsMiddleware = (req, res, next) => {
  const end = httpDuration.startTimer();
  captureRouteTemplate(req);
  res.on('finish', () => {
    end({ method: req.method, route: req.routeTemplate || 'unmatched', status: res.statusCode });
  });
  next();
};

const metricsHandler = async (req, res) => {
  const token = process.env.METRICS_TOKEN;
  if (token && req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
};

module.exports = {
  register,
  socketConnections,
  metricsMiddleware,
  metricsHandler,
};
