// ===========================================
// Express Application Setup
// ===========================================
// Main Express app configuration

import express, { type Application, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";
import pinoHttp from "pino-http";
import { nanoid } from "nanoid";

import { env, corsMiddleware } from "./config/index.js";
import { errorHandler, notFoundHandler, apiLimiter, maintenanceGuard } from "./middlewares/index.js";
import { logger } from "./lib/logger.js";

// Import routes
import { authRoutes, userRoutes, scraperRoutes, adminRoutes, paymentRoutes, channelRoutes } from "./routes/index.js";

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // Trust Railway / Vercel / any single reverse-proxy hop so that
  // express-rate-limit can read the real client IP from X-Forwarded-For.
  app.set("trust proxy", 1);

  // ===========================================
  // Security Middlewares
  // ===========================================

  // Helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS
  app.use(corsMiddleware);

  // Gzip/deflate response bodies. Skip when client already opted out
  // (e.g. Server-Sent Events / file downloads we want streamed). Compression
  // is CPU vs bandwidth — for our typical JSON payloads (history listings,
  // dashboard stats) this is a net win, often 70-80% smaller. Threshold of
  // 1KB skips tiny responses where compression overhead exceeds savings.
  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
    }),
  );

  // ===========================================
  // Body Parsing & Cookies
  // ===========================================

  // 1MB is plenty for cookie JSON (typical CookieForge export ~30KB) and
  // any normal JSON body. Previously 10MB which made /cookies a memory-
  // exhaustion target.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());

  // ===========================================
  // Logging
  // ===========================================

  // pino-http: structured per-request logging + auto-attaches a unique
  // request ID to req.id and req.log so service code can do
  // `req.log.info({ orderCode }, "...")` and have it correlated with the
  // access log line.
  app.use(
    pinoHttp({
      logger,
      // Use the X-Request-Id header if upstream sent one (e.g. nginx),
      // otherwise generate a short ID we'll echo back in the response.
      genReqId: (req, res) => {
        const incoming = req.headers["x-request-id"];
        const id = (Array.isArray(incoming) ? incoming[0] : incoming) || nanoid(10);
        res.setHeader("X-Request-Id", id);
        return id;
      },
      // Health checks are noisy and useless in production; drop them to
      // trace to keep info+ logs tidy.
      customLogLevel: (req, res, err) => {
        if (err || (res.statusCode ?? 0) >= 500) return "error";
        if ((res.statusCode ?? 0) >= 400) return "warn";
        if (req.url === "/health" || req.url?.startsWith("/api/v1/health")) return "trace";
        return "info";
      },
    }),
  );

  // Keep morgan only in dev for the colored one-liner that's easier to scan
  // when actively debugging. Pino-http handles the structured prod logs.
  if (env.isDevelopment) {
    app.use(morgan("dev"));
  }

  // ===========================================
  // Rate Limiting
  // ===========================================

  app.use(apiLimiter);

  // ===========================================
  // Maintenance Mode Guard
  // ===========================================

  app.use(maintenanceGuard);

  // ===========================================
  // Health Check
  // ===========================================

  app.get("/health", async (req: Request, res: Response) => {
    const { checkDatabaseHealth } = await import("./config/database.js");
    const { getRedisClient } = await import("./lib/redis.js");

    const dbHealthy = await checkDatabaseHealth();
    let redisHealthy = false;
    try {
      const redis = getRedisClient();
      await redis.ping();
      redisHealthy = true;
    } catch {
      redisHealthy = false;
    }

    // Only gate the HTTP status on the database — Redis is optional/recoverable.
    // Returning 503 when Redis is temporarily unavailable would cause Railway to
    // kill the container even though the app is fully functional.
    res.status(dbHealthy ? 200 : 503).json({
      status: dbHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealthy,
      redis: env.rateLimit.useRedis ? redisHealthy : "disabled",
      environment: env.nodeEnv,
    });
  });

  // ===========================================
  // Public Settings (no auth, no maintenance guard)
  // ===========================================

  app.get(`/api/${env.apiVersion}/settings/pricing`, async (_req: Request, res: Response) => {
    try {
      const { getPlanPricing, getPlanMaxComments, getPlanRetentionDays, getSettingNumber, getContactInfo } =
        await import("./utils/settings.js");
      const [pricing, maxComments, retention, maxTrialUses, contact] = await Promise.all([
        getPlanPricing(),
        getPlanMaxComments(),
        getPlanRetentionDays(),
        getSettingNumber("maxTrialUses"),
        getContactInfo(),
      ]);
      res.json({
        success: true,
        data: { pricing, maxComments, retention, maxTrialUses: maxTrialUses ?? 3, contact },
      });
    } catch {
      res.status(500).json({ success: false, error: { message: "Failed to fetch pricing" } });
    }
  });

  // ===========================================
  // API Routes
  // ===========================================

  const apiPrefix = `/api/${env.apiVersion}`;

  // Placeholder routes (will be implemented in Phase 2)
  app.get(`${apiPrefix}/`, (req: Request, res: Response) => {
    res.json({
      success: true,
      message: "Web Scraper API",
      version: env.apiVersion,
      documentation: "/api/v1/docs",
    });
  });

  // Register routes
  app.use(`${apiPrefix}/auth`, authRoutes);
  app.use(`${apiPrefix}/users`, userRoutes);
  app.use(`${apiPrefix}/scraper`, scraperRoutes);
  app.use(`${apiPrefix}/admin`, adminRoutes);
  app.use(`${apiPrefix}/payments`, paymentRoutes);
  app.use(`${apiPrefix}/channel`, channelRoutes);

  // ===========================================
  // Error Handling
  // ===========================================

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}
