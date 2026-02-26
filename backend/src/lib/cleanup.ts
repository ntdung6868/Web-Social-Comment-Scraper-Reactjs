// ===========================================
// Data Retention Cleanup Job
// ===========================================
// Automatically deletes scrape history based on plan-specific retention periods.
// All limits are read from the GlobalSettings DB collection (admin-configurable).
// Defaults (used when no DB override exists):
//   FREE: 1 day | PERSONAL: 3 days | PREMIUM: 5 days

import { prisma } from "../config/database.js";
import { getPlanRetentionDays } from "../utils/settings.js";

/**
 * Delete expired scrape histories based on each user's plan retention period.
 * Retention values are read from GlobalSettings on every run, so admin changes
 * take effect at the next hourly tick without a server restart.
 * Runs silently — only logs when records are actually deleted.
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
        console.log(`🧹 Cleanup [${planType}]: deleted ${result.count} records older than ${days}d`);
      }
    } catch (error) {
      console.error(`❌ Cleanup error for ${planType} plan:`, error);
    }
  }

  if (totalDeleted > 0) {
    console.log(`🧹 Cleanup total: ${totalDeleted} records deleted`);
  }
}

// Interval handle for graceful shutdown
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic cleanup job.
 * Runs every hour — does NOT run immediately on startup to avoid startup noise.
 */
export function startCleanupJob(): void {
  const ONE_HOUR = 60 * 60 * 1000;

  // Schedule hourly — skip immediate run on startup
  cleanupInterval = setInterval(() => {
    cleanupExpiredHistories().catch((err) => console.error("❌ Scheduled cleanup failed:", err));
  }, ONE_HOUR);
}

/**
 * Stop the cleanup job (for graceful shutdown).
 */
export function stopCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
