// ===========================================
// Scraper Repository
// ===========================================
// Data access layer for scraping operations

import { prisma } from "../config/database.js";
import type { ScrapeHistory, Comment, Prisma } from "@prisma/client";
import type { Platform, ScrapeStatus } from "../types/enums.js";
import type { ScrapedComment, PaginatedResponse, ScrapeHistoryItem } from "../types/scraper.types.js";

// ===========================================
// Types
// ===========================================

export interface CreateHistoryData {
  userId: number;
  platform: Platform;
  url: string;
}

export interface HistoryFilters {
  userId?: number;
  platform?: Platform;
  status?: ScrapeStatus;
}

export interface HistoryPagination {
  page: number;
  limit: number;
  sortBy?: "createdAt" | "totalComments";
  sortOrder?: "asc" | "desc";
}

// ===========================================
// Scraper Repository Class
// ===========================================

export class ScraperRepository {
  // ===========================================
  // History Operations
  // ===========================================

  /**
   * Create new scrape history record
   */
  async createHistory(data: CreateHistoryData): Promise<ScrapeHistory> {
    return prisma.scrapeHistory.create({
      data: {
        userId: data.userId,
        platform: data.platform,
        url: data.url,
        status: "PENDING",
        totalComments: 0,
      },
    });
  }

  /**
   * Get history by ID
   */
  async getHistoryById(id: number): Promise<ScrapeHistory | null> {
    return prisma.scrapeHistory.findUnique({
      where: { id },
    });
  }

  /**
   * Get history by ID with comments
   */
  async getHistoryWithComments(
    id: number,
    commentLimit = 1000,
  ): Promise<(ScrapeHistory & { comments: Comment[] }) | null> {
    return prisma.scrapeHistory.findUnique({
      where: { id },
      include: {
        comments: {
          take: commentLimit,
          orderBy: { scrapedAt: "asc" },
        },
      },
    });
  }

  /**
   * Update history status
   */
  async updateHistoryStatus(id: number, status: ScrapeStatus, errorMessage?: string): Promise<ScrapeHistory> {
    return prisma.scrapeHistory.update({
      where: { id },
      data: {
        status,
        errorMessage: errorMessage ?? null,
      },
    });
  }

  /**
   * Update history with comment count
   */
  async updateHistoryCommentCount(id: number, count: number): Promise<ScrapeHistory> {
    return prisma.scrapeHistory.update({
      where: { id },
      data: {
        totalComments: count,
        status: count > 0 ? "SUCCESS" : "FAILED",
      },
    });
  }

  /**
   * Get paginated history for user
   */
  async getHistoryList(
    filters: HistoryFilters,
    pagination: HistoryPagination,
  ): Promise<PaginatedResponse<ScrapeHistoryItem>> {
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

    const [items, totalItems] = await Promise.all([
      prisma.scrapeHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { comments: true },
          },
        },
      }),
      prisma.scrapeHistory.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: items.map((item) => ({
        id: item.id,
        userId: item.userId,
        platform: item.platform as Platform,
        url: item.url,
        totalComments: item.totalComments,
        status: item.status as ScrapeStatus,
        errorMessage: item.errorMessage,
        createdAt: item.createdAt,
        commentCount: item._count.comments,
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
   * Delete history and associated comments
   */
  async deleteHistory(id: number): Promise<void> {
    await prisma.scrapeHistory.delete({
      where: { id },
    });
  }

  /**
   * Check if history belongs to user
   */
  async isHistoryOwner(historyId: number, userId: number): Promise<boolean> {
    const history = await prisma.scrapeHistory.findFirst({
      where: { id: historyId, userId },
      select: { id: true },
    });
    return history !== null;
  }

  // ===========================================
  // Comment Operations
  // ===========================================

  /**
   * Save scraped comments in batch
   */
  async saveComments(historyId: number, comments: ScrapedComment[]): Promise<number> {
    if (comments.length === 0) return 0;

    const result = await prisma.comment.createMany({
      data: comments.map((comment) => ({
        scrapeHistoryId: historyId,
        username: comment.username.substring(0, 100),
        content: comment.content,
        timestamp: comment.timestamp?.substring(0, 100) ?? null,
        likes: comment.likes,
      })),
    });

    // Update history comment count
    await this.updateHistoryCommentCount(historyId, result.count);

    return result.count;
  }

  /**
   * Get comments for history with pagination
   */
  async getComments(historyId: number, page: number, limit: number): Promise<PaginatedResponse<Comment>> {
    const skip = (page - 1) * limit;

    const [comments, totalItems] = await Promise.all([
      prisma.comment.findMany({
        where: { scrapeHistoryId: historyId },
        skip,
        take: limit,
        orderBy: { scrapedAt: "asc" },
      }),
      prisma.comment.count({
        where: { scrapeHistoryId: historyId },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: comments,
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
   * Get all comments for export (no pagination)
   */
  async getAllCommentsForExport(historyId: number, limit?: number): Promise<Comment[]> {
    return prisma.comment.findMany({
      where: { scrapeHistoryId: historyId },
      orderBy: { scrapedAt: "asc" },
      ...(limit && { take: limit }),
    });
  }

  // ===========================================
  // Statistics
  // ===========================================

  /**
   * Get dashboard statistics for user
   */
  async getUserStats(userId: number): Promise<{
    totalScrapes: number;
    totalComments: number;
    successScrapes: number;
    failedScrapes: number;
  }> {
    const [totals, successCount, failedCount] = await Promise.all([
      prisma.scrapeHistory.aggregate({
        where: { userId },
        _count: true,
        _sum: { totalComments: true },
      }),
      prisma.scrapeHistory.count({
        where: { userId, status: "SUCCESS" },
      }),
      prisma.scrapeHistory.count({
        where: { userId, status: "FAILED" },
      }),
    ]);

    return {
      totalScrapes: totals._count,
      totalComments: totals._sum.totalComments ?? 0,
      successScrapes: successCount,
      failedScrapes: failedCount,
    };
  }

  /**
   * Get recent scrapes for user
   */
  async getRecentScrapes(userId: number, limit = 5): Promise<ScrapeHistory[]> {
    return prisma.scrapeHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}

// Export singleton instance
export const scraperRepository = new ScraperRepository();
