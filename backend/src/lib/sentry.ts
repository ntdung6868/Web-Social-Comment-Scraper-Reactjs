// ===========================================
// Sentry Integration (Backend)
// ===========================================
// Captures unhandled errors / unhandled rejections / explicit captureException
// calls and ships them to Sentry. No-op when SENTRY_DSN env is unset, so dev
// machines don't spam your error budget.
//
// Setup:
//   1. Create a project at sentry.io (free tier covers 5k events/month)
//   2. Set SENTRY_DSN in .env to the project's DSN
//   3. (optional) SENTRY_TRACES_SAMPLE_RATE=0.1 for 10% performance traces

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { logger } from "./logger.js";

let initialized = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info("Sentry not configured (SENTRY_DSN unset) — skipping");
    return;
  }

  if (initialized) return;
  initialized = true;

  const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1");
  const profilesSampleRate = parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? "0");

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    integrations: [nodeProfilingIntegration()],
    // Trace 10% of requests by default — adjust per traffic
    tracesSampleRate,
    profilesSampleRate,
    // Don't ship dev noise unless explicitly opted in
    enabled: process.env.NODE_ENV === "production" || process.env.SENTRY_FORCE === "true",
    // Strip secrets that might end up in error context
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });

  logger.info({ tracesSampleRate, profilesSampleRate }, "Sentry initialized");
}

/**
 * Express error-capture middleware. Mount AFTER routes but BEFORE the
 * regular error handler so we ship to Sentry first, then return JSON.
 */
export const sentryErrorHandler = Sentry.expressErrorHandler();

/** Mount FIRST in the middleware chain to instrument requests for tracing. */
export const sentryRequestHandler = (() => {
  // Sentry's setupExpressErrorHandler also installs request handler
  // automatically when init runs. The expressIntegration is added by Sentry.init
  // since SDK v8. Returning a no-op middleware to keep the API symmetrical
  // with older versions.
  return (_req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) =>
    next();
})();

export { Sentry };
