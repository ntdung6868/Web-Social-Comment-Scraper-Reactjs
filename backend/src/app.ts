// ===========================================
// Express Application Setup
// ===========================================
// Main Express app configuration

import express, { type Application } from "express";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env, corsMiddleware } from "./config/index.js";
import { errorHandler, notFoundHandler, apiLimiter, maintenanceGuard } from "./middlewares/index.js";

// Import routes
import { authRoutes, userRoutes, scraperRoutes, adminRoutes } from "./routes/index.js";

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

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

  // ===========================================
  // Body Parsing & Cookies
  // ===========================================

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());

  // ===========================================
  // Logging
  // ===========================================

  if (env.isDevelopment) {
    app.use(morgan("dev"));
  } else {
    app.use(morgan("combined"));
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

  app.get("/health", async (req, res) => {
    const { checkDatabaseHealth } = await import("./config/database.js");
    const dbHealthy = await checkDatabaseHealth();

    res.status(dbHealthy ? 200 : 503).json({
      status: dbHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealthy,
      environment: env.nodeEnv,
    });
  });

  // ===========================================
  // Public Settings (no auth, no maintenance guard)
  // ===========================================

  app.get(`/api/${env.apiVersion}/settings/pricing`, async (_req, res) => {
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
  app.get(`${apiPrefix}/`, (req, res) => {
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

  // ===========================================
  // Error Handling
  // ===========================================

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}
