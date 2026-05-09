// ===========================================
// Sentry Integration (Frontend)
// ===========================================
// Captures unhandled JS errors / promise rejections / explicit captureException
// calls. No-op when VITE_SENTRY_DSN is unset, so dev builds don't spam your
// error budget.
//
// Setup:
//   1. Reuse the same Sentry project as backend OR create a separate one
//   2. Set VITE_SENTRY_DSN in frontend/.env.production
//   3. Rebuild frontend; errors from real users will start showing up

import * as Sentry from "@sentry/react";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // Silent no-op in dev / when not configured

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false })],
    // Sample 10% of regular sessions for performance, 100% on error
    tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    enabled: import.meta.env.PROD,
    // Don't ship the auth token / cookies if Sentry sniffs the request body
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["Cookie"];
      }
      return event;
    },
  });
}

export { Sentry };
