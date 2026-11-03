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
const app = express();
const initializeSocketIO = require("./sockets/index");
const swaggerUi = require("swagger-ui-express");
const openApiSpec = require("./docs/openapi");

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
  res.status(200).json({ status: "OK", message: "Server is running" });
});

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

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log(
        `Server running in ${
          process.env.NODE_ENV || "development"
        } mode on port ${PORT}`
      );
    });
    console.log(`Socket.io server running on port ${PORT}`);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  io.close();
  server.close(async () => {
    await mongoose.connection.close();
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
