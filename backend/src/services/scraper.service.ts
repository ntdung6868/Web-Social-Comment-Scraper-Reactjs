// ===========================================
// Scraper Service
// ===========================================
// Business logic for scraping operations

import type { Platform, ScrapeStatus, ProxyRotation } from "../types/enums.js";
import { scraperRepository } from "../repositories/scraper.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { createError } from "../middlewares/error.middleware.js";
import { getPlanMaxComments } from "../utils/settings.js";
import {
  addScrapeJob,
  getJobByHistoryId,
  registerProcessor,
  userHasActiveJob,
  userHasJobInQueues,
  cancelUserJobs,
} from "../lib/queue.js";
import { createScraper, proxyManager, withRetry } from "../lib/scraper/index.js";
import { emitScrapeStarted, emitScrapeCompleted, emitScrapeFailed } from "../lib/socket.js";
import { detectPlatform } from "../validators/scraper.validators.js";
import type {
  ScrapeHistoryItem,
  ScrapeHistoryDetail,
  DashboardStats,
  PaginatedResponse,
  ScrapedComment,
} from "../types/scraper.types.js";
import type { ScrapeJobData, ScrapeJobResult, InMemoryJob, JobInfo } from "../types/queue.types.js";
import type { ScrapeRequestInput, HistoryListQueryInput } from "../validators/scraper.validators.js";

// ===========================================
// Scraper Service Class
// ===========================================

export class ScraperService {
  private isProcessorRegistered = false;

  constructor() {
    // registerJobProcessor is async (reads freeConcurrency from DB).
    // Fire-and-forget from constructor — workers will be ready before any
    // HTTP request can reach the scrape endpoint.
    this.registerJobProcessor().catch((err) =>
      console.error("[ScraperService] Failed to register job processor:", err),
    );
  }

  // ===========================================
  // Scraping Operations
  // ===========================================

  /**
   * Start a new scrape job
   */
  async startScrape(
    userId: string,
    data: ScrapeRequestInput,
  ): Promise<{
    historyId: string;
    jobId: string;
    queuePosition: number;
    isPaid: boolean;
  }> {
    // Check if user can scrape
    const canScrape = await userRepository.canScrape(userId);
    if (!canScrape.canScrape) {
      throw createError.forbidden(canScrape.message, "SCRAPE_LIMIT_REACHED");
    }

    // Check if user already has an active/waiting job (1 concurrent job per user).
    // Two-level check:
    //  1. In-memory registry (fast, covers the normal running case)
    //  2. BullMQ Redis queues (catches post-restart orphaned jobs that are no
    //     longer in the registry but are still being processed by a worker)
    if (userHasActiveJob(userId) || (await userHasJobInQueues(userId))) {
      throw createError.conflict(
        "You already have a scrape job running. Please wait for it to finish, or use the reset option if the job appears stuck.",
      );
    }

    // Detect platform from URL
    const platform = detectPlatform(data.url);
    if (!platform) {
      throw createError.badRequest("Unsupported URL format");
    }

    // Get user settings for cookies and proxy
    const user = await userRepository.findById(userId);
    if (!user) {
      throw createError.notFound("User not found");
    }

    // Get cookie data based on platform
    let cookieData: string | null = null;
    let userAgent: string | null = null;

    if (platform === "TIKTOK" && user.useTiktokCookie && user.tiktokCookieData) {
      cookieData = user.tiktokCookieData;
      userAgent = user.tiktokCookieUserAgent;
    } else if (platform === "FACEBOOK" && user.useFacebookCookie && user.facebookCookieData) {
      cookieData = user.facebookCookieData;
      userAgent = user.facebookCookieUserAgent;
    }

    // Get proxy if enabled
    let proxy: string | null = null;
    if (user.proxyEnabled && user.proxyList) {
      proxyManager.setProxies(user.proxyList, user.proxyRotation as ProxyRotation | undefined);
      proxy = proxyManager.getNext();
    }

    // Cap maxComments based on plan (read from global settings)
    const PLAN_MAX_COMMENTS = await getPlanMaxComments();
    const planLimit = PLAN_MAX_COMMENTS[user.planType] ?? 100;
    let effectiveMaxComments = data.maxComments;
    if (effectiveMaxComments) {
      effectiveMaxComments = Math.min(effectiveMaxComments, planLimit);
    } else {
      effectiveMaxComments = planLimit;
    }

    // Create history record
    const history = await scraperRepository.createHistory({
      userId,
      platform,
      url: data.url,
    });

    // Add job to queue
    const jobData: ScrapeJobData = {
      historyId: history.id,
      userId,
      url: data.url,
      platform,
      planType: user.planType as "FREE" | "PERSONAL" | "PREMIUM",
      cookies: {
        data: cookieData,
        userAgent,
      },
      proxy,
      headless: user.headlessMode,
      maxComments: effectiveMaxComments,
    };

    const jobId = await addScrapeJob(jobData);

    // Use trial scrape if on free plan
    if (user.planType === "FREE") {
      await userRepository.useTrialScrape(userId);
    }

    return {
      historyId: history.id,
      jobId,
      queuePosition: 1, // Will be updated by socket
      isPaid: user.planType === "PERSONAL" || user.planType === "PREMIUM",
    };
  }

  /**
   * Get scrape job status
   */
  async getJobStatus(
    historyId: string,
    userId: string,
  ): Promise<{
    history: ScrapeHistoryItem;
    job: JobInfo | null;
  }> {
    // Verify ownership
    const isOwner = await scraperRepository.isHistoryOwner(historyId, userId);
    if (!isOwner) {
      throw createError.forbidden("Access denied");
    }

    const history = await scraperRepository.getHistoryById(historyId);
    if (!history) {
      throw createError.notFound("Scrape history not found");
    }

    const job = getJobByHistoryId(historyId);

    return {
      history: {
        id: history.id,
        userId: history.userId,
        platform: history.platform as Platform,
        url: history.url,
        totalComments: history.totalComments,
        status: history.status as ScrapeStatus,
        errorMessage: history.errorMessage,
        createdAt: history.createdAt,
        commentCount: history.totalComments,
      },
      job,
    };
  }

  // ===========================================
  // History Operations
  // ===========================================

  /**
   * Get paginated scrape history for user
   */
  async getHistory(userId: string, query: HistoryListQueryInput): Promise<PaginatedResponse<ScrapeHistoryItem>> {
    return scraperRepository.getHistoryList(
      {
        userId,
        platform: query.platform as Platform | undefined,
        status: query.status as ScrapeStatus | undefined,
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
   * Get history detail with comments
   */
  async getHistoryDetail(historyId: string, userId: string, isAdmin = false): Promise<ScrapeHistoryDetail> {
    // Verify ownership or admin
    if (!isAdmin) {
      const isOwner = await scraperRepository.isHistoryOwner(historyId, userId);
      if (!isOwner) {
        throw createError.forbidden("Access denied");
      }
    }

    const history = await scraperRepository.getHistoryWithComments(historyId);
    if (!history) {
      throw createError.notFound("Scrape history not found");
    }

    return {
      id: history.id,
      userId: history.userId,
      platform: history.platform as Platform,
      url: history.url,
      totalComments: history.totalComments,
      status: history.status as ScrapeStatus,
      errorMessage: history.errorMessage,
      createdAt: history.createdAt,
      comments: history.comments.map((c) => ({
        id: c.id,
        username: c.username,
        content: c.content,
        timestamp: c.timestamp,
        likes: c.likes,
        scrapedAt: c.scrapedAt,
      })),
    };
  }

  /**
   * Delete scrape history
   */
  async deleteHistory(historyId: string, userId: string, isAdmin = false): Promise<void> {
    // Verify ownership or admin
    if (!isAdmin) {
      const isOwner = await scraperRepository.isHistoryOwner(historyId, userId);
      if (!isOwner) {
        throw createError.forbidden("Access denied");
      }
    }

    await scraperRepository.deleteHistory(historyId);
  }

  // ===========================================
  // Force Reset (Phantom Job Recovery)
  // ===========================================

  /**
   * Clear all stuck / phantom jobs for a user.
   *
   * A "phantom job" occurs when a server crash leaves a PENDING/RUNNING DB
   * record but the queue no longer has the matching job, making the user
   * unable to start a new scrape. This method:
   *   1. Marks every PENDING/RUNNING DB record as FAILED.
   *   2. Removes matching jobs from both BullMQ queues and the in-memory
   *      registry so userHasActiveJob() returns false immediately.
   */
  async resetScraper(userId: string): Promise<{ dbRecordsFixed: number; queueJobsCleared: number }> {
    const [dbRecordsFixed, queueJobsCleared] = await Promise.all([
      scraperRepository.failStuckJobsForUser(userId),
      cancelUserJobs(userId),
    ]);

    console.log(
      `[ScraperService] Force-reset for user ${userId}: ` +
        `${dbRecordsFixed} DB records fixed, ${queueJobsCleared} queue jobs cleared`,
    );

    return { dbRecordsFixed, queueJobsCleared };
  }

  // ===========================================
  // Dashboard Stats
  // ===========================================

  /**
   * Get dashboard statistics for user
   */
  async getDashboardStats(userId: string): Promise<DashboardStats> {
    return scraperRepository.getUserStats(userId);
  }

  /**
   * Get recent scrapes for user
   */
  async getRecentScrapes(userId: string, limit = 5): Promise<ScrapeHistoryItem[]> {
    const scrapes = await scraperRepository.getRecentScrapes(userId, limit);

    return scrapes.map((s) => ({
      id: s.id,
      userId: s.userId,
      platform: s.platform as Platform,
      url: s.url,
      totalComments: s.totalComments,
      status: s.status as ScrapeStatus,
      errorMessage: s.errorMessage,
      createdAt: s.createdAt,
      commentCount: s.totalComments,
    }));
  }

  // ===========================================
  // Export Operations
  // ===========================================

  /**
   * Get comments for export
   */
  async getCommentsForExport(
    historyId: string,
    userId: string,
    isAdmin = false,
  ): Promise<{
    history: { url: string; platform: Platform; createdAt: Date };
    comments: ScrapedComment[];
  }> {
    // Verify ownership or admin
    if (!isAdmin) {
      const isOwner = await scraperRepository.isHistoryOwner(historyId, userId);
      if (!isOwner) {
        throw createError.forbidden("Access denied");
      }
    }

    const history = await scraperRepository.getHistoryById(historyId);
    if (!history) {
      throw createError.notFound("Scrape history not found");
    }

    // Check download limit based on plan (from global settings)
    const user = await userRepository.findById(userId);
    const PLAN_EXPORT_LIMITS = await getPlanMaxComments();
    const downloadLimit = user ? (PLAN_EXPORT_LIMITS[user.planType] ?? 100) : 100;

    const comments = await scraperRepository.getAllCommentsForExport(historyId, downloadLimit);

    return {
      history: {
        url: history.url,
        platform: history.platform as Platform,
        createdAt: history.createdAt,
      },
      comments: comments.map((c) => ({
        username: c.username,
        content: c.content,
        timestamp: c.timestamp,
        likes: c.likes,
      })),
    };
  }

  // ===========================================
  // Job Processor
  // ===========================================

  /**
   * Register the job processor for the queue
   */
  private async registerJobProcessor(): Promise<void> {
    if (this.isProcessorRegistered) return;

    await registerProcessor(async (job: InMemoryJob): Promise<ScrapeJobResult> => {
      const { historyId, userId, url, platform, cookies, proxy, headless, maxComments } = job.data;
      const startTime = Date.now();

      try {
        // Update history status to running
        await scraperRepository.updateHistoryStatus(historyId, "RUNNING");

        // Emit started event
        emitScrapeStarted(userId, {
          historyId,
          url,
          platform,
          message: "Scraping started...",
          timestamp: new Date(),
        });

        // Create and run scraper with retry logic
        const result = await withRetry(
          async () => {
            const scraper = createScraper(platform, {
              userId,
              historyId,
              cookies,
              proxy,
              headless,
              maxComments,
            });

            return scraper.scrape(url);
          },
          {
            maxRetries: 2,
            baseDelay: 5000,
            shouldRetry: (error) => {
              const msg = error.message.toLowerCase();
              // Retry on network/timeout errors, not on invalid URLs
              return msg.includes("timeout") || msg.includes("network") || msg.includes("captcha");
            },
          },
        );

        if (!result.success) {
          throw new Error(result.error || "Scraping failed");
        }

        // Save comments to database
        const savedCount = await scraperRepository.saveComments(historyId, result.comments);

        // Update history status
        await scraperRepository.updateHistoryStatus(historyId, "SUCCESS");

        const duration = Date.now() - startTime;

        // Emit completed event
        emitScrapeCompleted(userId, {
          historyId,
          totalComments: savedCount,
          duration,
          message: `Successfully scraped ${savedCount} comments`,
          timestamp: new Date(),
        });

        return {
          historyId,
          success: true,
          totalComments: savedCount,
          duration,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const duration = Date.now() - startTime;

        // Update history status
        await scraperRepository.updateHistoryStatus(historyId, "FAILED", errorMessage);

        // Emit failed event
        emitScrapeFailed(userId, {
          historyId,
          error: errorMessage,
          code: "SCRAPE_FAILED",
          retryable: false,
          timestamp: new Date(),
        });

        return {
          historyId,
          success: false,
          totalComments: 0,
          duration,
          error: errorMessage,
        };
      }
    });

    this.isProcessorRegistered = true;
    console.log("[ScraperService] Job processor registered");
  }
}

// Export singleton instance
export const scraperService = new ScraperService();
