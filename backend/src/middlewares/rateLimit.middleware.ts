// ===========================================
// Rate Limiting Middleware
// ===========================================
// Request rate limiting for API protection

import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { sendTooManyRequests } from "../utils/response.js";

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendTooManyRequests(res, "Too many requests, please try again later");
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === "/health";
  },
});

/**
 * Strict rate limiter for auth endpoints (login, register)
 * 10 requests per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendTooManyRequests(res, "Too many authentication attempts, please try again in 15 minutes");
  },
});

/**
 * Very strict rate limiter for sensitive operations (password reset)
 * 3 requests per hour
 */
export const sensitiveOpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendTooManyRequests(res, "Too many attempts, please try again in 1 hour");
  },
});

/**
 * Scraping rate limiter
 * 20 scrapes per hour per user
 */
export const scrapeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.userId.toString() ?? req.ip ?? "unknown";
  },
  handler: (req, res) => {
    sendTooManyRequests(res, "Scraping limit reached, please try again in 1 hour");
  },
});
