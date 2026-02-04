// ===========================================
// API Response Types
// ===========================================
// Standardized API response structures

/**
 * Base API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
}

/**
 * API Error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: ValidationError[] | Record<string, unknown>;
}

/**
 * Validation error detail
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Success response helper type
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Error response helper type
 */
export interface ErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * HTTP Error codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

/**
 * Error codes for API responses
 */
export const ErrorCodes = {
  // Auth errors
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_BANNED: "USER_BANNED",
  USER_INACTIVE: "USER_INACTIVE",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  TOKEN_REVOKED: "TOKEN_REVOKED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_FIELD: "MISSING_FIELD",

  // User errors
  USERNAME_TAKEN: "USERNAME_TAKEN",
  EMAIL_TAKEN: "EMAIL_TAKEN",
  INVALID_PASSWORD: "INVALID_PASSWORD",
  PASSWORD_MISMATCH: "PASSWORD_MISMATCH",
  RATE_LIMITED: "RATE_LIMITED",

  // Scraper errors
  INVALID_URL: "INVALID_URL",
  UNSUPPORTED_PLATFORM: "UNSUPPORTED_PLATFORM",
  SCRAPE_FAILED: "SCRAPE_FAILED",
  SCRAPE_IN_PROGRESS: "SCRAPE_IN_PROGRESS",
  NO_TRIAL_REMAINING: "NO_TRIAL_REMAINING",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",

  // Resource errors
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptime: number;
  database: boolean;
  scraperService: boolean;
}
