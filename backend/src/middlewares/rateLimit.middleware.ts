// ===========================================
// Rate Limiting Middleware
// ===========================================
// Request rate limiting for API protection. Backed by Redis when available
// so counters survive container restarts and are shared across worker instances.

import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import type { Store } from "express-rate-limit";
import { env } from "../config/env.js";
import { sendTooManyRequests } from "../utils/response.js";
import { getRedisClient } from "../lib/redis.js";

// ===========================================
// Redis Store Factory
// ===========================================
// Each rate-limit window needs its own RedisStore instance (the package
// keys data per-store). We share a single Redis client. Falls back to
// the default in-memory store if Redis isn't configured / available.

function makeStore(prefix: string): Store | undefined {
  if (!env.rateLimit.useRedis) {
    console.warn(
      `[RateLimit] Redis backing disabled (RATE_LIMIT_USE_REDIS=false). ` +
        `Counters reset on restart and don't share across instances. Window: ${prefix}`,
    );
    return undefined;
  }

  try {
    const redis = getRedisClient();
    return new RedisStore({
      // ioredis exposes `.call(cmd, ...args)`; rate-limit-redis expects a
      // sendCommand that resolves to the result of a Redis command.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendCommand: (...args: string[]) => (redis as any).call(...args),
      prefix: `rl:${prefix}:`,
    });
  } catch (e) {
    console.error(`[RateLimit] Failed to construct RedisStore for ${prefix} — falling back to in-memory:`, e);
    return undefined;
  }
}

// ===========================================
// Common keyGenerator
// ===========================================

const ipKey = (req: import("express").Request) =>
  req.ip ?? req.socket.remoteAddress ?? "unknown";

const userOrIpKey = (req: import("express").Request) =>
  req.user?.userId.toString() ?? ipKey(req);

// ===========================================
// Limiters
// ===========================================

/**
 * General API rate limiter (broad).
 */
export const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("api"),
  keyGenerator: ipKey,
  handler: (_req, res) => sendTooManyRequests(res, "Too many requests, please try again later"),
  skip: (req) => req.path === "/health",
});

/**
 * Strict rate limiter for auth endpoints (login, register).
 * 20 requests per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("auth"),
  keyGenerator: ipKey,
  handler: (_req, res) =>
    sendTooManyRequests(res, "Too many authentication attempts, please try again in 15 minutes"),
});

/**
 * Very strict rate limiter for sensitive operations (password reset).
 * 3 requests per hour per IP.
 */
export const sensitiveOpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("sensitive"),
  keyGenerator: ipKey,
  handler: (_req, res) => sendTooManyRequests(res, "Too many attempts, please try again in 1 hour"),
});

/**
 * Payment rate limiter — 10 payment link creations per hour per user.
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("payment"),
  keyGenerator: userOrIpKey,
  handler: (_req, res) =>
    sendTooManyRequests(res, "Too many payment attempts, please try again in 1 hour"),
});

/**
 * Scraping rate limiter — 20 scrapes per hour per user.
 */
export const scrapeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("scrape"),
  keyGenerator: userOrIpKey,
  handler: (_req, res) => sendTooManyRequests(res, "Scraping limit reached, please try again in 1 hour"),
});
