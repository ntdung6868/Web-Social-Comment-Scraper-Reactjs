// ===========================================
// Scraper Service
// ===========================================
// Business logic for scraping operations

import type { Platform, ScrapeStatus, ProxyRotation } from "../types/enums.js";
import { scraperRepository } from "../repositories/scraper.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { createError } from "../middlewares/error.middleware.js";
import { addScrapeJob, getJobByHistoryId, registerProcessor } from "../lib/queue.js";
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
    // Register job processor on instantiation
    this.registerJobProcessor();
  }

  // ===========================================
  // Scraping Operations
  // ===========================================

  /**
   * Start a new scrape job
   */
  async startScrape(
    userId: number,
    data: ScrapeRequestInput,
  ): Promise<{
    historyId: number;
    jobId: string;
    queuePosition: number;
  }> {
    // Check if user can scrape
    const canScrape = await userRepository.canScrape(userId);
    if (!canScrape.canScrape) {
      throw createError.forbidden(canScrape.message, "SCRAPE_LIMIT_REACHED");
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

    // Cap maxComments based on plan
    const PLAN_MAX_COMMENTS: Record<string, number> = {
      FREE: 100,
      PERSONAL: 5000,
      PREMIUM: 50000,
    };
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
    };
  }

  /**
   * Get scrape job status
   */
  async getJobStatus(
    historyId: number,
    userId: number,
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
  async getHistory(userId: number, query: HistoryListQueryInput): Promise<PaginatedResponse<ScrapeHistoryItem>> {
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
  async getHistoryDetail(historyId: number, userId: number, isAdmin = false): Promise<ScrapeHistoryDetail> {
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
  async deleteHistory(historyId: number, userId: number, isAdmin = false): Promise<void> {
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
  // Dashboard Stats
  // ===========================================

  /**
   * Get dashboard statistics for user
   */
  async getDashboardStats(userId: number): Promise<DashboardStats> {
    return scraperRepository.getUserStats(userId);
  }

  /**
   * Get recent scrapes for user
   */
  async getRecentScrapes(userId: number, limit = 5): Promise<ScrapeHistoryItem[]> {
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
    historyId: number,
    userId: number,
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

    // Check download limit based on plan
    const user = await userRepository.findById(userId);
    const PLAN_EXPORT_LIMITS: Record<string, number | undefined> = {
      FREE: 100,
      PERSONAL: 5000,
      PREMIUM: 50000,
    };
    const downloadLimit = user ? PLAN_EXPORT_LIMITS[user.planType] : 100;

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
  private registerJobProcessor(): void {
    if (this.isProcessorRegistered) return;

    registerProcessor(async (job: InMemoryJob): Promise<ScrapeJobResult> => {
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
