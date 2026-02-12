// ===========================================
// Admin Repository
// ===========================================
// Data access layer for admin operations

import { prisma } from "../config/database.js";
import type { User, Prisma } from "@prisma/client";
import type { Platform, ScrapeStatus, PlanType, PlanStatus } from "../types/enums.js";
import type { AdminUserListItem, AdminUserDetail, AdminScrapeLog } from "../types/admin.types.js";
import type { PaginatedResponse } from "../types/scraper.types.js";

// ===========================================
// Types
// ===========================================

export interface UserFilters {
  search?: string;
  planType?: PlanType;
  planStatus?: PlanStatus;
  isBanned?: boolean;
  isAdmin?: boolean;
}

export interface UserPagination {
  page: number;
  limit: number;
  sortBy?: "createdAt" | "username" | "email" | "scrapeCount";
  sortOrder?: "asc" | "desc";
}

export interface ScrapeFilters {
  userId?: number;
  platform?: Platform;
  status?: ScrapeStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ScrapePagination {
  page: number;
  limit: number;
  sortBy?: "createdAt" | "totalComments";
  sortOrder?: "asc" | "desc";
}

// ===========================================
// Admin Repository Class
// ===========================================

export class AdminRepository {
  // ===========================================
  // User Management
  // ===========================================

  /**
   * Get paginated list of all users with scrape counts
   */
  async getUserList(filters: UserFilters, pagination: UserPagination): Promise<PaginatedResponse<AdminUserListItem>> {
    const { page, limit, sortBy = "createdAt", sortOrder = "desc" } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (filters.search) {
      // SQLite LIKE is case-insensitive by default for ASCII
      where.OR = [{ username: { contains: filters.search } }, { email: { contains: filters.search } }];
    }
    if (filters.planType) {
      where.planType = filters.planType;
    }
    if (filters.planStatus) {
      where.planStatus = filters.planStatus;
    }
    if (filters.isBanned !== undefined) {
      where.isBanned = filters.isBanned;
    }
    if (filters.isAdmin !== undefined) {
      where.isAdmin = filters.isAdmin;
    }

    // Handle sortBy for scrapeCount
    let orderBy: Prisma.UserOrderByWithRelationInput;
    if (sortBy === "scrapeCount") {
      orderBy = {
        scrapeHistories: {
          _count: sortOrder,
        },
      };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const [users, totalItems] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: { scrapeHistories: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Get distinct IP counts for these users
    const userIds = users.map((u) => u.id);
    let ipCountMap: Record<number, number> = {};
    if (userIds.length > 0) {
      const ipCounts = await prisma.$queryRawUnsafe<{ user_id: number; ip_count: number }[]>(
        `SELECT user_id, COUNT(DISTINCT ip_address) as ip_count FROM refresh_tokens WHERE user_id IN (${userIds.join(",")}) AND ip_address IS NOT NULL GROUP BY user_id`,
      );
      ipCountMap = ipCounts.reduce(
        (acc, row) => {
          acc[row.user_id] = Number(row.ip_count);
          return acc;
        },
        {} as Record<number, number>,
      );
    }

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        isActive: user.isActive,
        isAdmin: user.isAdmin,
        planType: user.planType as PlanType,
        planStatus: user.planStatus as PlanStatus,
        trialUses: user.trialUses,
        maxTrialUses: user.maxTrialUses,
        isBanned: user.isBanned,
        scrapeCount: user._count.scrapeHistories,
        distinctIpCount: ipCountMap[user.id] ?? 0,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get detailed user info for admin
   */
  async getUserDetail(userId: number): Promise<AdminUserDetail | null> {
    const [user, ipResult] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: { scrapeHistories: true },
          },
        },
      }),
      prisma.$queryRaw<
        { ip_count: number }[]
      >`SELECT COUNT(DISTINCT ip_address) as ip_count FROM refresh_tokens WHERE user_id = ${userId} AND ip_address IS NOT NULL`,
    ]);

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      isActive: user.isActive,
      isAdmin: user.isAdmin,
      planType: user.planType as PlanType,
      planStatus: user.planStatus as PlanStatus,
      trialUses: user.trialUses,
      maxTrialUses: user.maxTrialUses,
      isBanned: user.isBanned,
      scrapeCount: user._count.scrapeHistories,
      distinctIpCount: Number(ipResult[0]?.ip_count ?? 0),
      banReason: user.banReason,
      bannedAt: user.bannedAt,
      subscriptionStart: user.subscriptionStart,
      subscriptionEnd: user.subscriptionEnd,
      lastPasswordChange: user.lastPasswordChange,
      lastEmailChange: user.lastEmailChange,
      proxyEnabled: user.proxyEnabled,
      headlessMode: user.headlessMode,
      hasTiktokCookie: !!user.tiktokCookieData,
      hasFacebookCookie: !!user.facebookCookieData,
    };
  }

  /**
   * Update user (admin only fields)
   */
  async updateUser(
    userId: number,
    data: {
      username?: string;
      email?: string;
      passwordHash?: string;
      isActive?: boolean;
      isAdmin?: boolean;
      planType?: PlanType;
      planStatus?: PlanStatus;
      trialUses?: number;
      maxTrialUses?: number;
      subscriptionEnd?: Date | null;
    },
  ): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /**
   * Ban a user
   */
  async banUser(userId: number, reason: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        banReason: reason,
        bannedAt: new Date(),
      },
    });
  }

  /**
   * Unban a user
   */
  async unbanUser(userId: number): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        banReason: null,
        bannedAt: null,
      },
    });
  }

  /**
   * Delete a user and all related data
   */
  async deleteUser(userId: number): Promise<void> {
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  // ===========================================
  // Scrape Log Management
  // ===========================================

  /**
   * Get paginated scrape logs
   */
  async getScrapeLogList(
    filters: ScrapeFilters,
    pagination: ScrapePagination,
  ): Promise<PaginatedResponse<AdminScrapeLog>> {
    const { page, limit, sortBy = "createdAt", sortOrder = "desc" } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ScrapeHistoryWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.platform) {
      where.platform = filters.platform;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    const [logs, totalItems] = await Promise.all([
      prisma.scrapeHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: { username: true },
          },
        },
      }),
      prisma.scrapeHistory.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        username: log.user.username,
        platform: log.platform as Platform,
        url: log.url,
        status: log.status as ScrapeStatus,
        totalComments: log.totalComments,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // ===========================================
  // Statistics
  // ===========================================

  /**
   * Get admin dashboard statistics
   */
  async getDashboardStats(): Promise<{
    users: {
      total: number;
      active: number;
      banned: number;
      newToday: number;
      newThisWeek: number;
    };
    subscriptions: {
      free: number;
      pro: number;
      expired: number;
    };
    scraping: {
      totalJobs: number;
      successfulJobs: number;
      failedJobs: number;
      totalComments: number;
      avgCompletionTime: number;
    };
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      newToday,
      newThisWeek,
      freeUsers,
      proUsers,
      expiredUsers,
      totalScrapes,
      successfulScrapes,
      failedScrapes,
      commentsAggregate,
      completedScrapes,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true, isBanned: false } }),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.user.count({ where: { planType: "FREE" } }),
      prisma.user.count({ where: { planType: { in: ["PERSONAL", "PREMIUM"] } } }),
      prisma.user.count({ where: { planStatus: "EXPIRED" } }),
      prisma.scrapeHistory.count(),
      prisma.scrapeHistory.count({ where: { status: "SUCCESS" } }),
      prisma.scrapeHistory.count({ where: { status: "FAILED" } }),
      prisma.scrapeHistory.aggregate({ _sum: { totalComments: true } }),
      prisma.scrapeHistory.findMany({
        where: {
          status: { in: ["SUCCESS", "FAILED"] },
          updatedAt: { not: null },
        },
        select: { createdAt: true, updatedAt: true },
      }),
    ]);

    // Calculate average completion time in seconds
    let avgCompletionTime = 0;
    if (completedScrapes.length > 0) {
      const totalMs = completedScrapes.reduce((sum, s) => {
        const duration = new Date(s.updatedAt!).getTime() - new Date(s.createdAt).getTime();
        return sum + Math.max(0, duration);
      }, 0);
      avgCompletionTime = Math.round(totalMs / completedScrapes.length / 1000);
    }

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
        newToday,
        newThisWeek,
      },
      subscriptions: {
        free: freeUsers,
        pro: proUsers,
        expired: expiredUsers,
      },
      scraping: {
        totalJobs: totalScrapes,
        successfulJobs: successfulScrapes,
        failedJobs: failedScrapes,
        totalComments: commentsAggregate._sum.totalComments ?? 0,
        avgCompletionTime,
      },
    };
  }

  // ===========================================
  // Global Settings
  // ===========================================

  /**
   * Get all global settings
   */
  async getAllSettings(): Promise<Record<string, string | null>> {
    const settings = await prisma.globalSettings.findMany();
    return settings.reduce(
      (acc, s) => {
        acc[s.key] = s.value;
        return acc;
      },
      {} as Record<string, string | null>,
    );
  }

  /**
   * Get setting by key
   */
  async getSetting(key: string): Promise<string | null> {
    const setting = await prisma.globalSettings.findUnique({
      where: { key },
    });
    return setting?.value ?? null;
  }

  /**
   * Update or create setting
   */
  async setSetting(key: string, value: string | null, updatedBy: number): Promise<void> {
    await prisma.globalSettings.upsert({
      where: { key },
      create: { key, value, updatedBy },
      update: { value, updatedBy },
    });
  }

  // ===========================================
  // Session Management
  // ===========================================

  /**
   * Get all active sessions across all users
   */
  async getActiveSessions(page: number, limit: number): Promise<{ data: any[]; total: number }> {
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.refreshToken.findMany({
        where: {
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, username: true, email: true, isAdmin: true, planType: true },
          },
        },
      }),
      prisma.refreshToken.count({
        where: {
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    return {
      data: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        username: s.user.username,
        email: s.user.email,
        isAdmin: s.user.isAdmin,
        planType: s.user.planType,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        deviceInfo: s.deviceInfo,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
      total,
    };
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: number): Promise<void> {
    await prisma.refreshToken.update({
      where: { id: sessionId },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: number): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
    return result.count;
  }

  /**
   * Get user's scrape history for admin
   */
  async getUserScrapeHistory(
    userId: number,
    page: number,
    limit: number,
  ): Promise<{ data: AdminScrapeLog[]; total: number }> {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.scrapeHistory.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { username: true } },
        },
      }),
      prisma.scrapeHistory.count({ where: { userId } }),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        username: log.user.username,
        platform: log.platform as Platform,
        url: log.url,
        status: log.status as ScrapeStatus,
        totalComments: log.totalComments,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
      })),
      total,
    };
  }
}

// Export singleton instance
export const adminRepository = new AdminRepository();
