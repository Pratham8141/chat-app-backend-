import { Response } from "express";
import { ApiResponse, PaginationMeta } from "../types";

// ─────────────────────────────────────────
// Custom Error Class
// ─────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─────────────────────────────────────────
// Response Helpers
// ─────────────────────────────────────────

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  pagination?: PaginationMeta
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    pagination,
  };
  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  code?: string
): void {
  const response: ApiResponse = {
    success: false,
    error: message,
    message: code,
  };
  res.status(statusCode).json(response);
}

export function buildPagination(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
