// ===========================================
// Rate Limiting Middleware
// ===========================================
// Request rate limiting for API protection using Redis

import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { sendTooManyRequests } from "../utils/response.js";
import { getRedisClient } from "../lib/redis.js";

// Flag to track if Redis is available
let redisAvailable = false;

/**
 * Check if Redis is available
 */
async function checkRedisAvailable(): Promise<boolean> {
  if (!env.rateLimit.useRedis) return false;
  try {
    const redis = getRedisClient();
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

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
  skip: async (req) => {
    // Check Redis availability on first request
    if (!redisAvailable && env.rateLimit.useRedis) {
      redisAvailable = await checkRedisAvailable();
    }
    return req.path === "/health";
  },
});

/**
 * Strict rate limiter for auth endpoints (login, register)
 * 20 requests per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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
  windowMs: 60 * 60 * 1000,
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
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.userId.toString() ?? req.ip ?? "unknown";
  },
  handler: (req, res) => {
    sendTooManyRequests(res, "Scraping limit reached, please try again in 1 hour");
  },
});
