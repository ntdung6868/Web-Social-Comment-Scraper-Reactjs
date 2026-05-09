// ===========================================
// Server Entry Point
// ===========================================
// Application bootstrap and startup

// IMPORTANT: Sentry init must run BEFORE any other import that might throw,
// so it can capture early-startup errors. Keep this at the very top.
import { initSentry } from "./lib/sentry.js";
initSentry();

import { createServer } from "http";
import { createApp } from "./app.js";
import { env, connectDatabase, disconnectDatabase } from "./config/index.js";
import { initializeSocket } from "./lib/socket.js";
import { startCleanupJob, stopCleanupJob } from "./lib/cleanup.js";
import { connectRedis, closeRedis } from "./lib/redis.js";

/**
 * Start the server
 */
async function bootstrap(): Promise<void> {
  try {
    console.log("🚀 Starting Web Scraper Backend...");
    console.log(`📍 Environment: ${env.nodeEnv}`);

    // Connect to Redis (optional - will fall back to memory if fails)
    if (env.rateLimit.useRedis) {
      try {
        await connectRedis();
        console.log("✅ Redis connected for rate limiting");
      } catch (error) {
        console.warn("⚠️ Redis connection failed, falling back to in-memory rate limiting");
      }
    }

    // Connect to database
    await connectDatabase();

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.io
    initializeSocket(httpServer);
    console.log("🔌 Socket.io initialized");

    // Start data retention cleanup job
    startCleanupJob();

    // Start HTTP server
    httpServer.listen(env.port, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${env.port}`);
      console.log(`📡 API available at http://localhost:${env.port}/api/${env.apiVersion}`);
      console.log(`🔌 WebSocket available at ws://localhost:${env.port}`);
      console.log(`❤️  Health check at http://localhost:${env.port}/health`);
    });

    // ===========================================
    // Graceful Shutdown
    // ===========================================

    const shutdown = async (signal: string) => {
      console.log(`\n📤 Received ${signal}. Starting graceful shutdown...`);

      // 1. Stop cron-style cleanup job so it can't kick off mid-shutdown
      stopCleanupJob();

      // 2. Stop accepting new HTTP connections (existing keep-alives still drain)
      const httpClosed = new Promise<void>((resolve) => {
        httpServer.close(() => {
          console.log("🔌 HTTP server closed");
          resolve();
        });
      });

      // 3. Drain BullMQ workers — let active scrape jobs finish (or hit their
      //    own internal timeouts), but cap so a hung scrape doesn't block
      //    container shutdown longer than the orchestrator's grace period.
      const { closeWorkers } = await import("./lib/queue.js");
      const workersClosed = closeWorkers(25_000).catch((e) => {
        console.warn("⚠️ Worker close errored:", e);
      });

      await Promise.all([httpClosed, workersClosed]);

      // 4. Close infra clients
      await closeRedis();
      await disconnectDatabase();

      console.log("👋 Shutdown complete");
      process.exit(0);
    };

    // Hard ceiling — if anything above hangs, force-exit so the orchestrator
    // doesn't kill -9 us (which would orphan Chromium / leave Redis state).
    const installForceExit = () =>
      setTimeout(() => {
        console.error("⚠️ Forced shutdown after 35s timeout");
        process.exit(1);
      }, 35_000);

    // Handle shutdown signals — install force-exit timer so orchestrator
    // SIGKILL (which kills mid-flight Chromium) is avoided.
    process.on("SIGTERM", () => {
      installForceExit();
      shutdown("SIGTERM");
    });
    process.on("SIGINT", () => {
      installForceExit();
      shutdown("SIGINT");
    });

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
      console.error("💥 Uncaught Exception:", error);
      shutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
      // Don't shutdown on unhandled rejection in development
      if (env.isProduction) {
        shutdown("unhandledRejection");
      }
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
bootstrap();
