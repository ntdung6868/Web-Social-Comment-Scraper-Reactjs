// ===========================================
// API Response Helpers
// ===========================================
// Standardized response formatting

import type { Response } from "express";
import type {
  ApiResponse,
  ApiError,
  ValidationError,
  ErrorCode,
  HttpStatusCode,
  HttpStatus,
} from "../types/api.types.js";

/**
 * Send success response
 * @param res - Express response object
 * @param data - Response data
 * @param message - Optional success message
 * @param statusCode - HTTP status code (default: 200)
 */
export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode: HttpStatusCode = 200): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send created response (201)
 * @param res - Express response object
 * @param data - Created resource data
 * @param message - Optional success message
 */
export function sendCreated<T>(res: Response, data: T, message?: string): Response {
  return sendSuccess(res, data, message, 201);
}

/**
 * Send no content response (204)
 * @param res - Express response object
 */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

/**
 * Send error response
 * @param res - Express response object
 * @param code - Error code
 * @param message - Error message
 * @param statusCode - HTTP status code
 * @param details - Optional error details
 */
export function sendError(
  res: Response,
  code: ErrorCode | string,
  message: string,
  statusCode: HttpStatusCode,
  details?: ValidationError[] | Record<string, unknown>,
): Response {
  const error: ApiError = {
    code,
    message,
  };

  if (details) {
    error.details = details;
  }

  const response: ApiResponse = {
    success: false,
    error,
  };

  return res.status(statusCode).json(response);
}

/**
 * Send bad request error (400)
 */
export function sendBadRequest(
  res: Response,
  message: string,
  code: ErrorCode | string = "INVALID_INPUT",
  details?: ValidationError[],
): Response {
  return sendError(res, code, message, 400, details);
}

/**
 * Send unauthorized error (401)
 */
export function sendUnauthorized(
  res: Response,
  message: string = "Unauthorized",
  code: ErrorCode | string = "UNAUTHORIZED",
): Response {
  return sendError(res, code, message, 401);
}

/**
 * Send forbidden error (403)
 */
export function sendForbidden(
  res: Response,
  message: string = "Forbidden",
  code: ErrorCode | string = "FORBIDDEN",
): Response {
  return sendError(res, code, message, 403);
}

/**
 * Send not found error (404)
 */
export function sendNotFound(
  res: Response,
  message: string = "Resource not found",
  code: ErrorCode | string = "NOT_FOUND",
): Response {
  return sendError(res, code, message, 404);
}

/**
 * Send conflict error (409)
 */
export function sendConflict(res: Response, message: string, code: ErrorCode | string = "ALREADY_EXISTS"): Response {
  return sendError(res, code, message, 409);
}

/**
 * Send validation error (422)
 */
export function sendValidationError(res: Response, errors: ValidationError[]): Response {
  return sendError(res, "VALIDATION_ERROR", "Validation failed", 422, errors);
}

/**
 * Send too many requests error (429)
 */
export function sendTooManyRequests(
  res: Response,
  message: string = "Too many requests",
  code: ErrorCode | string = "RATE_LIMITED",
): Response {
  return sendError(res, code, message, 429);
}

/**
 * Send internal server error (500)
 */
export function sendInternalError(
  res: Response,
  message: string = "Internal server error",
  code: ErrorCode | string = "INTERNAL_ERROR",
): Response {
  return sendError(res, code, message, 500);
}

/**
 * Send service unavailable error (503)
 */
export function sendServiceUnavailable(
  res: Response,
  message: string = "Service unavailable",
  code: ErrorCode | string = "SERVICE_UNAVAILABLE",
): Response {
  return sendError(res, code, message, 503);
}
