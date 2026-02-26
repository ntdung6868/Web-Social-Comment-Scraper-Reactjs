// ===========================================
// Admin Service
// ===========================================
// Business logic for admin operations

import os from "os";
import { adminRepository } from "../repositories/admin.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { authRepository } from "../repositories/auth.repository.js";
import { createError } from "../middlewares/error.middleware.js";
import { invalidateMaintenanceCache } from "../middlewares/maintenance.middleware.js";
import { checkDatabaseHealth } from "../config/database.js";
import { getQueueStats, getAllJobs, addScrapeJob, getWorkerConcurrency } from "../lib/queue.js";
import { getConnectedUserCount, getConnectedSocketCount } from "../lib/socket.js";
import { getRedisClient } from "../lib/redis.js";
import { prisma } from "../config/database.js";
import { hashPassword } from "../utils/password.js";
import type {
  SystemHealth,
  AdminDashboardStats,
  AdminUserListItem,
  AdminUserDetail,
  AdminScrapeLog,
} from "../types/admin.types.js";
import type { PaginatedResponse } from "../types/scraper.types.js";
import type {
  AdminUserListQueryInput,
  AdminUserUpdateInput,
  BanUserInput,
  AdminScrapeListQueryInput,
} from "../validators/admin.validators.js";

// ===========================================
// Admin Service Class
// ===========================================

export class AdminService {
  // ===========================================
  // System Health & Monitoring
  // ===========================================

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const startTime = Date.now();

    // Check database
    const dbHealthy = await checkDatabaseHealth();
    const dbLatency = Date.now() - startTime;

    // OS memory usage (accurate system-wide stats)
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const appMemory = process.memoryUsage().rss;

    // CPU usage
    const cpuLoad = os.loadavg();

    // Determine overall status based on OS memory
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (!dbHealthy) {
      status = "unhealthy";
    } else if (usedMemory / totalMemory > 0.9) {
      status = "degraded";
    }

    return {
      status,
      timestamp: new Date(),
      uptime: process.uptime(),
      services: {
        database: {
          status: dbHealthy ? "up" : "down",
          latency: dbLatency,
        },
        redis: await this.getRedisHealth(),
        scraper: {
          status: "up", // Assuming scraper is running locally
        },
      },
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100),
        app: appMemory,
      },
      cpu: {
        percentage: Math.round((cpuLoad[0] ?? 0) * 100) / 100,
        loadAverage: cpuLoad,
      },
    };
  }

  /**
   * Get Redis health status
   */
  async getRedisHealth(): Promise<{ status: "up" | "down" | "disabled"; latency?: number }> {
    const { env } = await import("../config/env.js");
    if (!env.rateLimit.useRedis) {
      return { status: "disabled" };
    }

    try {
      const redis = getRedisClient();
      const start = Date.now();
      await redis.ping();
      const latency = Date.now() - start;
      return { status: "up", latency };
    } catch {
      return { status: "down" };
    }
  }

  /**
   * Get admin dashboard statistics
   */
  async getDashboardStats(): Promise<AdminDashboardStats> {
    const dbStats = await adminRepository.getDashboardStats();
    const queueStats = getQueueStats();

    return {
      users: dbStats.users,
      subscriptions: dbStats.subscriptions,
      scraping: {
        ...dbStats.scraping,
        activeJobs: queueStats.active,
        queuedJobs: queueStats.waiting,
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
        cpuUsage: Math.round((os.loadavg()[0] ?? 0) * 100) / 100,
      },
      revenue: dbStats.revenue,
    };
  }

  /**
   * Get real-time stats
   */
  async getRealTimeStats(): Promise<{
    connectedUsers: number;
    connectedSockets: number;
    queueStats: ReturnType<typeof getQueueStats>;
    activeJobs: ReturnType<typeof getAllJobs>;
  }> {
    return {
      connectedUsers: getConnectedUserCount(),
      connectedSockets: getConnectedSocketCount(),
      queueStats: getQueueStats(),
      activeJobs: getAllJobs().filter((j) => j.status === "active" || j.status === "waiting"),
    };
  }

  // ===========================================
  // User Management
  // ===========================================

  /**
   * Get paginated list of users
   */
  async getUserList(query: AdminUserListQueryInput): Promise<PaginatedResponse<AdminUserListItem>> {
    return adminRepository.getUserList(
      {
        search: query.search,
        planType: query.planType,
        planStatus: query.planStatus,
        isBanned: query.isBanned,
        isAdmin: query.isAdmin,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    );
  }

  /**
   * Get user detail
   */
  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    const user = await adminRepository.getUserDetail(userId);
    if (!user) {
      throw createError.notFound("User not found");
    }
    return user;
  }

  /**
   * Update user
   */
  async updateUser(userId: string, data: AdminUserUpdateInput): Promise<AdminUserDetail> {
    // Check user exists
    const existingUser = await userRepository.findById(userId);
    if (!existingUser) {
      throw createError.notFound("User not found");
    }

    // Check unique constraints for username/email
    if (data.username && data.username !== existingUser.username) {
      const taken = await authRepository.usernameExists(data.username);
      if (taken) {
        throw createError.conflict("Username already taken");
      }
    }
    if (data.email && data.email !== existingUser.email) {
      const taken = await authRepository.emailExists(data.email);
      if (taken) {
        throw createError.conflict("Email already taken");
      }
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (data.password) {
      passwordHash = await hashPassword(data.password);
    }

    await adminRepository.updateUser(userId, {
      username: data.username,
      email: data.email,
      passwordHash,
      isActive: data.isActive,
      isAdmin: data.isAdmin,
      planType: data.planType,
      planStatus: data.planStatus,
      trialUses: data.trialUses,
      subscriptionEnd: data.subscriptionEnd,
    });

    return this.getUserDetail(userId);
  }

  /**
   * Ban a user
   */
  async banUser(userId: string, data: BanUserInput, adminId: string): Promise<AdminUserDetail> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw createError.notFound("User not found");
    }

    if (user.isAdmin) {
      throw createError.forbidden("Cannot ban an admin user");
    }

    if (user.id === adminId) {
      throw createError.forbidden("Cannot ban yourself");
    }

    await adminRepository.banUser(userId, data.reason);
    return this.getUserDetail(userId);
  }

  /**
   * Unban a user
   */
  async unbanUser(userId: string): Promise<AdminUserDetail> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw createError.notFound("User not found");
    }

    if (!user.isBanned) {
      throw createError.badRequest("User is not banned");
    }

    await adminRepository.unbanUser(userId);
    return this.getUserDetail(userId);
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string, adminId: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw createError.notFound("User not found");
    }

    if (user.isAdmin) {
      throw createError.forbidden("Cannot delete an admin user");
    }

    if (user.id === adminId) {
      throw createError.forbidden("Cannot delete yourself");
    }

    await adminRepository.deleteUser(userId);
  }

  /**
   * Reset user trial uses (reads default from global settings)
   */
  async resetTrialUses(userId: string, trialCount?: number): Promise<AdminUserDetail> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw createError.notFound("User not found");
    }

    // If no explicit count, read from global settings
    if (trialCount === undefined) {
      const { getSettingNumber } = await import("../utils/settings.js");
      trialCount = (await getSettingNumber("maxTrialUses")) ?? 3;
    }

    await adminRepository.updateUser(userId, {
      trialUses: trialCount,
      maxTrialUses: trialCount,
      planStatus: "ACTIVE",
    });

    return this.getUserDetail(userId);
  }

  /**
   * Grant paid subscription to user
   */
  async grantProSubscription(
    userId: string,
    durationDays: number,
    planType: "PERSONAL" | "PREMIUM" = "PREMIUM",
  ): Promise<AdminUserDetail> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw createError.notFound("User not found");
    }

    const subscriptionEnd = new Date();
    subscriptionEnd.setDate(subscriptionEnd.getDate() + durationDays);

    await adminRepository.updateUser(userId, {
      planType,
      planStatus: "ACTIVE",
      subscriptionEnd,
    });

    return this.getUserDetail(userId);
  }

  /**
   * Downgrade user to FREE plan
   */
  async downgradeToFree(userId: string): Promise<AdminUserDetail> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw createError.notFound("User not found");
    }

    // Read dynamic maxTrialUses from settings
    const { getSettingNumber } = await import("../utils/settings.js");
    const maxTrialUses = await getSettingNumber("maxTrialUses");

    await adminRepository.updateUser(userId, {
      planType: "FREE",
      planStatus: "ACTIVE",
      subscriptionEnd: null,
      trialUses: maxTrialUses,
      maxTrialUses,
    });

    return this.getUserDetail(userId);
  }

  // ===========================================
  // Scrape Log Management
  // ===========================================

  /**
   * Get paginated scrape logs
   */
  async getScrapeLogList(query: AdminScrapeListQueryInput): Promise<PaginatedResponse<AdminScrapeLog>> {
    return adminRepository.getScrapeLogList(
      {
        userId: query.userId,
        platform: query.platform,
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    );
  }

  // ===========================================
  // Global Settings
  // ===========================================

  /**
   * Get all global settings
   */
  async getAllSettings(): Promise<Record<string, string | null>> {
    return adminRepository.getAllSettings();
  }

  /**
   * Update global setting
   */
  async updateSetting(key: string, value: string | null, adminId: string): Promise<void> {
    await adminRepository.setSetting(key, value, adminId);
    // Invalidate caches when relevant settings change
    if (key === "maintenanceMode") {
      invalidateMaintenanceCache();
    }
  }

  /**
   * Check if maintenance mode is enabled
   */
  async isMaintenanceMode(): Promise<boolean> {
    const value = await adminRepository.getSetting("maintenanceMode");
    return value === "true";
  }

  /**
   * Toggle maintenance mode
   */
  async toggleMaintenanceMode(enabled: boolean, adminId: string): Promise<void> {
    await adminRepository.setSetting("maintenanceMode", enabled ? "true" : "false", adminId);
    invalidateMaintenanceCache();
  }

  // ===========================================
  // Session Management
  // ===========================================

  /**
   * Get active sessions
   */
  async getActiveSessions(page = 1, limit = 20) {
    return adminRepository.getActiveSessions(page, limit);
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await adminRepository.revokeSession(sessionId);
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw createError.notFound("User not found");
    }
    return adminRepository.revokeAllUserSessions(userId);
  }

  /**
   * Get user scrape history (admin view)
   */
  async getUserScrapeHistory(userId: string, page = 1, limit = 10) {
    return adminRepository.getUserScrapeHistory(userId, page, limit);
  }

  // ===========================================
  // Stress Test (performance benchmarking)
  // ===========================================

  /**
   * Inject N synthetic scrape jobs into the PREMIUM queue simultaneously.
   * Jobs use fake userIds (stress-test-user-{i}) so they never collide with
   * real users and bypass the "one active job per user" guard in scraper.service.
   * Workers will pick them up, launch browsers, fail on the fake URL, and clean up —
   * which is exactly the CPU/RAM load pattern needed for benchmarking.
   */
  async runStressTest(
    count: number,
    platform: "TIKTOK" | "FACEBOOK" = "TIKTOK",
    callerUserId?: string,
  ): Promise<{ injected: number; workerConcurrency: number; jobIds: string[] }> {
    // Find a real userId to attach the synthetic scrapeHistory records to.
    // Prefer the calling admin; fallback to the first admin in DB.
    const userId =
      callerUserId ??
      (await prisma.user.findFirst({ where: { isAdmin: true }, select: { id: true } }))?.id;

    if (!userId) {
      throw createError.badRequest("No admin user found to attach stress-test history records");
    }

    const testUrl =
      platform === "FACEBOOK"
        ? "https://www.facebook.com/stress-test-post"
        : "https://www.tiktok.com/@stress-test/video/0000000000000";

    // Create real ScrapeHistory rows so the processor can update them without Prisma ObjectId errors.
    // These will end up as FAILED (fake URL) — they're visible in admin scrape logs.
    const historyRecords = await Promise.all(
      Array.from({ length: count }, () =>
        prisma.scrapeHistory.create({
          data: { userId, platform, url: testUrl, status: "PENDING" },
          select: { id: true },
        }),
      ),
    );

    const jobIds: string[] = [];

    // Enqueue all jobs simultaneously into the PREMIUM lane
    await Promise.all(
      historyRecords.map(async ({ id: historyId }) => {
        await addScrapeJob({
          historyId,
          userId,
          url: testUrl,
          platform,
          planType: "PREMIUM",
          cookies: { data: null, userAgent: null },
          proxy: null,
          headless: true,
          maxComments: 10,
        });
        jobIds.push(historyId);
      }),
    );

    console.log(
      `[Admin] Stress test: injected ${count} jobs into PREMIUM queue` +
        ` | platform=${platform} | workerConcurrency=${getWorkerConcurrency()}`,
    );

    return { injected: count, workerConcurrency: getWorkerConcurrency(), jobIds };
  }
}
// Export singleton instance
export const adminService = new AdminService();
