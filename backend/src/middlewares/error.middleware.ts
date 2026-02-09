// ===========================================
// Error Handling Middleware
// ===========================================
// Global error handler and custom error classes

import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { env } from "../config/env.js";
import { sendInternalError, sendBadRequest, sendNotFound } from "../utils/response.js";

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(message: string, statusCode: number = 500, code: string = "INTERNAL_ERROR", details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create common API errors
 */
export const createError = {
  badRequest: (message: string, code?: string, details?: unknown) =>
    new ApiError(message, 400, code ?? "BAD_REQUEST", details),

  unauthorized: (message: string, code?: string) => new ApiError(message, 401, code ?? "UNAUTHORIZED"),

  forbidden: (message: string, code?: string) => new ApiError(message, 403, code ?? "FORBIDDEN"),

  notFound: (message: string, code?: string) => new ApiError(message, 404, code ?? "NOT_FOUND"),

  conflict: (message: string, code?: string) => new ApiError(message, 409, code ?? "CONFLICT"),

  validation: (message: string, details?: unknown) => new ApiError(message, 422, "VALIDATION_ERROR", details),

  tooManyRequests: (message: string) => new ApiError(message, 429, "RATE_LIMITED"),

  internal: (message: string) => new ApiError(message, 500, "INTERNAL_ERROR"),

  serviceUnavailable: (message: string) => new ApiError(message, 503, "SERVICE_UNAVAILABLE"),
};

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Log error in development
  if (env.isDevelopment) {
    console.error("Error:", err);
  } else {
    // Log minimal info in production
    console.error("Error:", err.message);
  }

  // Handle ApiError
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Handle Prisma errors
  if (err.name === "PrismaClientKnownRequestError") {
    const prismaError = err as unknown as { code: string; meta?: { target?: string[] } };

    if (prismaError.code === "P2002") {
      // Unique constraint violation
      const field = prismaError.meta?.target?.[0] ?? "field";
      sendBadRequest(res, `${field} already exists`, "ALREADY_EXISTS");
      return;
    }

    if (prismaError.code === "P2025") {
      // Record not found
      sendNotFound(res, "Resource not found");
      return;
    }
  }

  // Handle validation errors from express-validator
  if (err.name === "ValidationError") {
    sendBadRequest(res, err.message, "VALIDATION_ERROR");
    return;
  }

  // Handle JSON parse errors
  if (err instanceof SyntaxError && "body" in err) {
    sendBadRequest(res, "Invalid JSON in request body", "INVALID_JSON");
    return;
  }

  // Default to internal server error
  sendInternalError(res, env.isDevelopment ? err.message : "An unexpected error occurred");
};

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  sendNotFound(res, `Route ${req.method} ${req.path} not found`);
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * @param fn - Async route handler function
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
