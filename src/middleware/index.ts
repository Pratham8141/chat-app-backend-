import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { ZodSchema } from "zod";
import { verifyAccessToken } from "../utils/jwt";
import { AppError, sendError } from "../utils/response";
import { prisma } from "../config/prisma";
import { config } from "../config/env";
import { logger } from "../utils/logger";
import { AuthRequest } from "../types";

// ─────────────────────────────────────────
// Auth Middleware
// ─────────────────────────────────────────

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("No token provided", 401, "NO_TOKEN");
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    // Verify session is still active
    const session = await prisma.session.findFirst({
      where: { id: payload.sessionId, isActive: true },
    });
    if (!session) {
      throw new AppError("Session expired or revoked", 401, "SESSION_INVALID");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    });
    if (!user) {
      throw new AppError("User not found", 401, "USER_NOT_FOUND");
    }

    req.user = { id: user.id, email: user.email, profile: user.profile ?? undefined };
    req.sessionId = payload.sessionId;

    // Update session last active (fire-and-forget)
    prisma.session
      .update({
        where: { id: payload.sessionId },
        data: { lastActiveAt: new Date() },
      })
      .catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
}

export function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return next();
  authenticate(req, _res, next);
}

// ─────────────────────────────────────────
// Validation Middleware
// ─────────────────────────────────────────

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      res.status(422).json({
        success: false,
        error: "Validation failed",
        details: errors,
      });
      return;
    }
    req[source] = result.data;
    next();
  };
}

// ─────────────────────────────────────────
// Error Handler Middleware
// ─────────────────────────────────────────

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(`${err.name}: ${err.message}`, {
    stack: err.stack,
  });

  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.code);
    return;
  }

  // Prisma errors
  if (err.constructor.name === "PrismaClientKnownRequestError") {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === "P2002") {
      sendError(res, "Resource already exists", 409, "CONFLICT");
      return;
    }
    if (prismaErr.code === "P2025") {
      sendError(res, "Resource not found", 404, "NOT_FOUND");
      return;
    }
  }

  sendError(res, "Internal server error", 500, "INTERNAL_ERROR");
}

// ─────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────

export const globalRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later." },
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.authMax,
  message: { success: false, error: "Too many auth attempts, please wait 15 minutes." },
});

export const messageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: "Message rate limit exceeded." },
});

// ─────────────────────────────────────────
// File Upload (multer memory storage)
// ─────────────────────────────────────────

const storage = multer.memoryStorage();

function fileSizeLimit(mb: number) {
  return mb * 1024 * 1024;
}

export const uploadImage = multer({
  storage,
  limits: { fileSize: fileSizeLimit(config.upload.maxImageSizeMb) },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new AppError("Only image files allowed", 400));
  },
});

export const uploadVideo = multer({
  storage,
  limits: { fileSize: fileSizeLimit(config.upload.maxVideoSizeMb) },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new AppError("Only video files allowed", 400));
  },
});

export const uploadAudio = multer({
  storage,
  limits: { fileSize: fileSizeLimit(config.upload.maxAudioSizeMb) },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) cb(null, true);
    else cb(new AppError("Only audio files allowed", 400));
  },
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: fileSizeLimit(config.upload.maxDocumentSizeMb) },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "application/zip",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new AppError("File type not supported", 400));
  },
});

export const uploadAny = multer({
  storage,
  limits: { fileSize: fileSizeLimit(config.upload.maxFileSizeMb) },
});

// ─────────────────────────────────────────
// Not Found Handler
// ─────────────────────────────────────────

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ success: false, error: "Route not found" });
}
