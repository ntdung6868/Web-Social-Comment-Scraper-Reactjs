// ===========================================
// Admin Service
// ===========================================
// Business logic for admin operations

import os from "os";
import { adminRepository } from "../repositories/admin.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { authRepository } from "../repositories/auth.repository.js";
import { createError } from "../middlewares/error.middleware.js";
import { checkDatabaseHealth } from "../config/database.js";
import { getQueueStats, getAllJobs } from "../lib/queue.js";
import { getConnectedUserCount, getConnectedSocketCount } from "../lib/socket.js";
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

    // Memory usage
    const memUsage = process.memoryUsage();

    // CPU usage
    const cpuLoad = os.loadavg();

    // Determine overall status
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (!dbHealthy) {
      status = "unhealthy";
    } else if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
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
        redis: {
          status: "unknown", // Redis not implemented yet
        },
        scraper: {
          status: "up", // Assuming scraper is running locally
        },
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      cpu: {
        percentage: Math.round((cpuLoad[0] ?? 0) * 100) / 100,
        loadAverage: cpuLoad,
      },
    };
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
        memoryUsage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
        cpuUsage: Math.round((os.loadavg()[0] ?? 0) * 100) / 100,
      },
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
  async getUserDetail(userId: number): Promise<AdminUserDetail> {
    const user = await adminRepository.getUserDetail(userId);
    if (!user) {
      throw createError.notFound("User not found");
    }
    return user;
  }

  /**
   * Update user
   */
  async updateUser(userId: number, data: AdminUserUpdateInput): Promise<AdminUserDetail> {
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
  async banUser(userId: number, data: BanUserInput, adminId: number): Promise<AdminUserDetail> {
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
  async unbanUser(userId: number): Promise<AdminUserDetail> {
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
  async deleteUser(userId: number, adminId: number): Promise<void> {
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
   * Reset user trial uses
   */
  async resetTrialUses(userId: number, trialCount = 3): Promise<AdminUserDetail> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw createError.notFound("User not found");
    }

    await adminRepository.updateUser(userId, {
      trialUses: trialCount,
      planStatus: "ACTIVE",
    });

    return this.getUserDetail(userId);
  }

  /**
   * Grant paid subscription to user
   */
  async grantProSubscription(
    userId: number,
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
  async downgradeToFree(userId: number): Promise<AdminUserDetail> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw createError.notFound("User not found");
    }

    await adminRepository.updateUser(userId, {
      planType: "FREE",
      planStatus: "ACTIVE",
      subscriptionEnd: null,
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
  async updateSetting(key: string, value: string | null, adminId: number): Promise<void> {
    await adminRepository.setSetting(key, value, adminId);
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
  async toggleMaintenanceMode(enabled: boolean, adminId: number): Promise<void> {
    await adminRepository.setSetting("maintenanceMode", enabled ? "true" : "false", adminId);
  }
}

// Export singleton instance
export const adminService = new AdminService();
