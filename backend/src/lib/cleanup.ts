// ===========================================
// Data Retention Cleanup Job
// ===========================================
// Automatically deletes scrape history based on plan-specific retention periods.
// FREE: 1 day, PERSONAL: 3 days, PREMIUM: 5 days
// Also deletes ALL scrape histories older than 7 days (global hard limit).

import { prisma }from "../config/database.js";
import { getPlanRetentionDays } from "../utils/settings.js";

const GLOBAL_MAX_DAYS = 7;

/**
 * Delete expired scrape histories based on each user's plan retention period.
 * Also enforces a global hard limit of 7 days for all records.
 * Runs silently — only logs when records are actually deleted.
 */
async function cleanupExpiredHistories(): Promise<void> {
  const now = new Date();
  let totalDeleted = 0;

  // 1. Plan-based retention cleanup
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
      }
    } catch (error) {
      console.error(`❌ Cleanup error for ${planType} plan:`, error);
    }
  }

  // 2. Global hard limit: delete anything older than 7 days regardless of plan
  const globalCutoff = new Date(now.getTime() - GLOBAL_MAX_DAYS * 24 * 60 * 60 * 1000);
  try {
    const result = await prisma.scrapeHistory.deleteMany({
      where: { createdAt: { lt: globalCutoff } },
    });
    if (result.count > 0) {
      totalDeleted += result.count;
    }
  } catch (error) {
    console.error("❌ Global cleanup error:", error);
  }

  if (totalDeleted > 0) {
    console.log(`🧹 Cleanup: ${totalDeleted} old records deleted`);
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
