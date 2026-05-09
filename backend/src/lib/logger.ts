// ===========================================
// Logger
// ===========================================
// Centralized leveled logger built on pino. In development we pretty-print
// so logs are readable; in production we emit JSON-per-line so a log
// aggregator (Loki, Datadog, etc.) can ingest structured fields.
//
// Usage:
//   import { logger } from "../lib/logger.js";
//   logger.info({ userId, planType }, "Scrape started");
//   logger.error({ err }, "Failed to load cookies");
//
// Inside an Express handler use req.log (set by pino-http) so the request
// ID is auto-attached:
//   req.log.warn({ orderCode }, "Order not found");

import pino, { type LoggerOptions } from "pino";
import { env } from "../config/env.js";

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (env.isProduction ? "info" : "debug"),
  // Don't ever serialize an entire request object — pino's stdSerializers
  // drop the noise (cookies, headers) and keep what's useful for tracing.
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // Strip secrets that may end up in logged objects.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "headers.cookie",
      "*.password",
      "*.token",
      "*.refreshToken",
      "*.passwordHash",
      "*.cookieData",
      "*.tiktokSessionCookies",
      "*.tiktokCookieData",
    ],
    censor: "[REDACTED]",
  },
};

// Pretty-print in dev for readability; raw JSON in prod for ingestion.
export const logger = env.isProduction
  ? pino(baseOptions)
  : pino({
      ...baseOptions,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
          singleLine: false,
        },
      },
    });

logger.info({ env: env.nodeEnv, level: logger.level }, "Logger ready");
