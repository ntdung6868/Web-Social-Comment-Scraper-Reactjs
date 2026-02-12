// ===========================================
// Data Retention Cleanup Job
// ===========================================
// Automatically deletes scrape history based on plan-specific retention periods.
// FREE: 1 day, PERSONAL: 3 days, PREMIUM: 5 days

import { prisma } from "../config/database.js";

// Retention days per plan type
const PLAN_RETENTION_DAYS: Record<string, number> = {
  FREE: 1,
  PERSONAL: 3,
  PREMIUM: 5,
};

/**
 * Delete expired scrape histories based on each user's plan retention period.
 * Comments are cascade-deleted automatically via Prisma schema.
 */
async function cleanupExpiredHistories(): Promise<void> {
  const now = new Date();
  let totalDeleted = 0;

  for (const [planType, retentionDays] of Object.entries(PLAN_RETENTION_DAYS)) {
    const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

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
          `🧹 Cleanup: Deleted ${result.count} expired histories for ${planType} plan (older than ${retentionDays} day${retentionDays > 1 ? "s" : ""})`,
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
