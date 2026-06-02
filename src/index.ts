import "express-async-errors";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { config } from "./config/env";
import { initFirebase } from "./config/firebase";
import { initSocketServer } from "./socket";
import { prisma } from "./config/prisma";
import routes from "./routes";
import { errorHandler, notFound, globalRateLimit } from "./middleware";
import { logger } from "./utils/logger";

// ── Bootstrap ────────────────────────────

async function bootstrap() {
  // Init Firebase
  initFirebase();

  const app = express();
  const httpServer = http.createServer(app);

  // ── Global middleware ──────────────────
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());
  app.use(morgan(config.env === "production" ? "combined" : "dev"));
  app.use(globalRateLimit);

  // ── Routes ─────────────────────────────
  app.use(`/api/${config.apiVersion}`, routes);

  // ── Error handling ─────────────────────
  app.use(notFound);
  app.use(errorHandler);

  // ── Socket.IO ──────────────────────────
  initSocketServer(httpServer);

  // ── Start server ───────────────────────
  httpServer.listen(config.port, () => {
    logger.info(`🚀 Message Hub API running on port ${config.port} [${config.env}]`);
    logger.info(`📡 Socket.IO ready`);
  });

  // ── Graceful shutdown ──────────────────
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received — shutting down");
    await prisma.$disconnect();
    httpServer.close(() => process.exit(0));
  });

  process.on("SIGINT", async () => {
    logger.info("SIGINT received — shutting down");
    await prisma.$disconnect();
    httpServer.close(() => process.exit(0));
  });
}

bootstrap().catch((err) => {
  logger.error("Fatal startup error", err);
  process.exit(1);
});
