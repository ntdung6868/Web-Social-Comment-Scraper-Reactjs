// ===========================================
// Server Entry Point
// ===========================================
// Application bootstrap and startup

import { createServer } from "http";
import { createApp } from "./app.js";
import { env, connectDatabase, disconnectDatabase } from "./config/index.js";
import { initializeSocket } from "./lib/socket.js";
import { startCleanupJob, stopCleanupJob } from "./lib/cleanup.js";

/**
 * Start the server
 */
async function bootstrap(): Promise<void> {
  try {
    console.log("🚀 Starting Web Scraper Backend...");
    console.log(`📍 Environment: ${env.nodeEnv}`);

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
    httpServer.listen(env.port, () => {
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

      // Stop cleanup job
      stopCleanupJob();

      // Close HTTP server
      httpServer.close(async () => {
        console.log("🔌 HTTP server closed");

        // Disconnect database
        await disconnectDatabase();

        console.log("👋 Shutdown complete");
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error("⚠️ Forced shutdown after timeout");
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

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
