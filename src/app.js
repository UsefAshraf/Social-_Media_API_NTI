require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const cookieParser = require("cookie-parser");
const errorHandler = require("./shared/middleware/errorHandler");
const v2Routes = require("./api/v2");
const connectDB = require("./shared/config/db");
const multer = require("multer");
const { fileStorage, fileFilter, limits } = require("./shared/config/multerConfig");
const path = require("path");
const http = require("http");
const mongoose = require("mongoose");
const { getRedis, closeRedis } = require("./shared/config/redis");
const { closeQueues } = require("./shared/queue/queues");
const { startWorkers, stopWorkers } = require("./workers");
const app = express();
const initializeSocketIO = require("./sockets/index");
const swaggerUi = require("swagger-ui-express");
const openApiSpec = require("./docs/openapi");
const { logger } = require("./shared/utils/logger");
const { requestLogger } = require("./shared/middleware/requestLogger");
const { metricsMiddleware, metricsHandler } = require("./shared/metrics");

app.use(requestLogger);
app.use(metricsMiddleware);

// allow frontends on other origins to load /uploads images
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
const server = http.createServer(app);

const io = initializeSocketIO(server);
// lets controllers push real-time events via req.app.get("io")
app.set("io", io);

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(multer({ storage: fileStorage, fileFilter, limits }).single("image"));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use(mongoSanitize());

app.get("/health", (req, res) => {
  const redis = getRedis();
  const checks = {
    database: mongoose.connection.readyState === 1 ? "up" : "down",
    redis: redis ? (redis.status === "ready" ? "up" : "down") : "disabled",
  };
  const healthy = checks.database === "up" && checks.redis !== "down";

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "OK" : "DEGRADED",
    message: healthy ? "Server is running" : "A dependency is unavailable",
    checks,
  });
});

app.get("/metrics", metricsHandler);

app.get("/api-docs.json", (req, res) => res.json(openApiSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use("/api/v2", v2Routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let workers = [];

const startServer = async () => {
  try {
    await connectDB();

    // run queue workers in this process unless a separate worker handles them
    if (getRedis() && process.env.RUN_WORKERS !== "false") {
      workers = await startWorkers();
      logger.info("Queue workers started");
    }

    server.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV || "development" }, "Server listening (HTTP + Socket.IO)");
    });
  } catch (error) {
    logger.fatal({ err: error }, "Failed to start server");
    process.exit(1);
  }
};

const shutdown = (signal) => {
  logger.info({ signal }, "Shutting down");
  io.close();
  server.close(async () => {
    await stopWorkers(workers);
    await closeQueues();
    await Promise.all([mongoose.connection.close(), closeRedis()]);
    process.exit(0);
  });
  // force exit if connections do not close in time
  setTimeout(() => process.exit(1), 10000).unref();
};

if (require.main === module) {
  startServer();
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

module.exports = { app, server, io };
