// ===========================================
// Data Retention Cleanup Job
// ===========================================
// Automatically deletes scrape history based on plan-specific retention periods.
// FREE: 1 day, PERSONAL: 3 days, PREMIUM: 5 days

import { prisma } from "../config/database.js";
import { getPlanRetentionDays } from "../utils/settings.js";

/**
 * Delete expired scrape histories based on each user's plan retention period.
 * Retention days are read from GlobalSettings (admin-configurable).
 * Comments are cascade-deleted automatically via Prisma schema.
 */
async function cleanupExpiredHistories(): Promise<void> {
  const now = new Date();
  let totalDeleted = 0;

  const retentionDays = await getPlanRetentionDays();
  for (const [planType, days] of Object.entries(retentionDays)) {
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    try {
      const result = await prisma.scrapeHistory.deleteMany({
        where: {
          user: { planType },
          createdAt: { lt: cutoffDate },
        },
      });

      if (result.count > 0) {
        totalDeleted += result.count;
        console.log(
          `🧹 Cleanup: Deleted ${result.count} expired histories for ${planType} plan (older than ${days} day${days > 1 ? "s" : ""})`,
        );
      }
    } catch (error) {
      console.error(`❌ Cleanup error for ${planType} plan:`, error);
    }
  }

  if (totalDeleted > 0) {
    console.log(`🧹 Cleanup complete: ${totalDeleted} total histories deleted`);
  }
}

// Interval handle for graceful shutdown
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic cleanup job.
 * Runs immediately on start, then every hour.
 */
export function startCleanupJob(): void {
  const ONE_HOUR = 60 * 60 * 1000;

  // Run immediately on startup
  cleanupExpiredHistories().catch((err) => console.error("❌ Initial cleanup failed:", err));

  // Then run every hour
  cleanupInterval = setInterval(() => {
    cleanupExpiredHistories().catch((err) => console.error("❌ Scheduled cleanup failed:", err));
  }, ONE_HOUR);

  console.log("🧹 Data retention cleanup job started (runs every hour)");
}

/**
 * Stop the cleanup job (for graceful shutdown).
 */
export function stopCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("🧹 Cleanup job stopped");
  }
}
