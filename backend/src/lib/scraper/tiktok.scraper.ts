// ===========================================
// TikTok Scraper Engine (Playwright)
// ===========================================
// Core scraping logic using Response Interception

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { Platform } from "@prisma/client";
import type { ScrapedComment } from "../types/scraper.types.js";
import { emitScrapeProgress } from "./socket.js";

// ===========================================
// Types
// ===========================================

interface TikTokComment {
  cid: string;
  text: string;
  user: {
    nickname: string;
    unique_id: string;
    avatar_thumb?: { url_list: string[] };
  };
  create_time: number;
  digg_count: number;
  reply_comment_total: number;
  reply_comment?: TikTokComment[];
}

interface TikTokAPIResponse {
  comments?: TikTokComment[];
  comment_list?: TikTokComment[];
  has_more?: boolean;
  cursor?: number;
  total?: number;
}

interface ScrapeConfig {
  userId: number;
  historyId: number;
  cookies: { data: string | null; userAgent: string | null };
  proxy: string | null;
  headless: boolean;
  maxComments?: number;
  scrollTimeout?: number;
  maxScrollAttempts?: number;
}

interface ScrapeResult {
  success: boolean;
  comments: ScrapedComment[];
  totalComments: number;
  error?: string;
}

// ===========================================
// Constants
// ===========================================

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TIKTOK_COMMENT_API_PATTERNS = [
  /api.*\/comment\/list/,
  /api.*\/comment\/reply\/list/,
  /comment\/list/,
  /webcast.*comment/,
];

// ===========================================
// TikTok Scraper Class
// ===========================================

export class TikTokScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: ScrapeConfig;
  private comments: Map<string, ScrapedComment> = new Map();
  private isRunning = false;
  private abortController: AbortController | null = null;

  constructor(config: ScrapeConfig) {
    this.config = {
      maxComments: 1000,
      scrollTimeout: 5000,
      maxScrollAttempts: 50,
      ...config,
    };
  }

  /**
   * Main scrape method
   */
  async scrape(url: string): Promise<ScrapeResult> {
    this.isRunning = true;
    this.abortController = new AbortController();

    try {
      // Validate URL
      if (!this.isValidTikTokUrl(url)) {
        throw new Error("Invalid TikTok URL");
      }

      this.emitProgress("initializing", 0, "Launching browser...");

      // Launch browser
      await this.launchBrowser();

      this.emitProgress("loading", 10, "Loading page...");

      // Navigate to URL
      await this.navigateToUrl(url);

      this.emitProgress("scrolling", 20, "Waiting for comments to load...");

      // Wait for comments section
      await this.waitForComments();

      this.emitProgress("extracting", 30, "Extracting comments...");

      // Scroll and collect comments
      await this.scrollAndCollect();

      const commentsArray = Array.from(this.comments.values());

      this.emitProgress("saving", 90, `Found ${commentsArray.length} comments`);

      return {
        success: true,
        comments: commentsArray,
        totalComments: commentsArray.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[TikTokScraper] Error: ${errorMessage}`);

      return {
        success: false,
        comments: Array.from(this.comments.values()),
        totalComments: this.comments.size,
        error: errorMessage,
      };
    } finally {
      await this.cleanup();
      this.isRunning = false;
    }
  }

  /**
   * Cancel scraping
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isRunning = false;
  }

  // ===========================================
  // Private Methods
  // ===========================================

  private async launchBrowser(): Promise<void> {
    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: this.config.headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
    };

    // Add proxy if configured
    if (this.config.proxy) {
      const proxyUrl = this.parseProxyUrl(this.config.proxy);
      if (proxyUrl) {
        launchOptions.proxy = proxyUrl;
      }
    }

    this.browser = await chromium.launch(launchOptions);

    // Create context with user agent
    const userAgent = this.config.cookies.userAgent || DEFAULT_USER_AGENT;

    this.context = await this.browser.newContext({
      userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    // Set cookies if available
    if (this.config.cookies.data) {
      await this.setCookies(this.config.cookies.data);
    }

    // Create page
    this.page = await this.context.newPage();

    // Set up response interception
    this.setupResponseInterception();
  }

  private async setCookies(cookieData: string): Promise<void> {
    if (!this.context) return;

    try {
      const cookies = JSON.parse(cookieData);
      const formattedCookies = Array.isArray(cookies)
        ? cookies.map((c: Record<string, unknown>) => ({
            name: String(c.name || ""),
            value: String(c.value || ""),
            domain: String(c.domain || ".tiktok.com"),
            path: String(c.path || "/"),
            expires: typeof c.expirationDate === "number" ? c.expirationDate : undefined,
            httpOnly: Boolean(c.httpOnly),
            secure: Boolean(c.secure),
            sameSite: (c.sameSite as "Strict" | "Lax" | "None") || "Lax",
          }))
        : [];

      if (formattedCookies.length > 0) {
        await this.context.addCookies(formattedCookies);
        console.log(`[TikTokScraper] Set ${formattedCookies.length} cookies`);
      }
    } catch (error) {
      console.error("[TikTokScraper] Failed to set cookies:", error);
    }
  }

  private setupResponseInterception(): void {
    if (!this.page) return;

    this.page.on("response", async (response) => {
      const url = response.url();

      // Check if this is a comment API response
      const isCommentApi = TIKTOK_COMMENT_API_PATTERNS.some((pattern) => pattern.test(url));

      if (isCommentApi && response.status() === 200) {
        try {
          const data = (await response.json()) as TikTokAPIResponse;
          this.processAPIResponse(data);
        } catch {
          // Ignore JSON parse errors
        }
      }
    });
  }

  private processAPIResponse(data: TikTokAPIResponse): void {
    const comments = data.comments || data.comment_list || [];

    for (const comment of comments) {
      if (!this.comments.has(comment.cid)) {
        const scraped: ScrapedComment = {
          username: comment.user?.unique_id || comment.user?.nickname || "Unknown",
          content: comment.text || "",
          timestamp: comment.create_time ? new Date(comment.create_time * 1000).toISOString() : null,
          likes: comment.digg_count || 0,
        };

        this.comments.set(comment.cid, scraped);

        // Process reply comments if any
        if (comment.reply_comment && Array.isArray(comment.reply_comment)) {
          for (const reply of comment.reply_comment) {
            if (!this.comments.has(reply.cid)) {
              const scrapedReply: ScrapedComment = {
                username: reply.user?.unique_id || reply.user?.nickname || "Unknown",
                content: reply.text || "",
                timestamp: reply.create_time ? new Date(reply.create_time * 1000).toISOString() : null,
                likes: reply.digg_count || 0,
              };
              this.comments.set(reply.cid, scrapedReply);
            }
          }
        }
      }
    }

    // Emit progress update
    this.emitProgress(
      "extracting",
      Math.min(80, 30 + (this.comments.size / (this.config.maxComments || 1000)) * 50),
      `Found ${this.comments.size} comments...`,
    );
  }

  private async navigateToUrl(url: string): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for page to stabilize
    await this.page.waitForTimeout(2000);
  }

  private async waitForComments(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    // Try multiple selectors for comment section
    const commentSelectors = [
      '[data-e2e="comment-list"]',
      '[class*="CommentList"]',
      '[class*="comment-list"]',
      ".tiktok-comments",
      "#comments",
    ];

    for (const selector of commentSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 10000 });
        console.log(`[TikTokScraper] Found comments with selector: ${selector}`);
        return;
      } catch {
        // Try next selector
      }
    }

    // If no comment section found, try to click "View comments" button
    const viewCommentsSelectors = [
      '[data-e2e="comment-icon"]',
      '[class*="CommentButton"]',
      'button:has-text("comments")',
    ];

    for (const selector of viewCommentsSelectors) {
      try {
        const button = await this.page.$(selector);
        if (button) {
          await button.click();
          await this.page.waitForTimeout(2000);
          console.log(`[TikTokScraper] Clicked comment button: ${selector}`);
          return;
        }
      } catch {
        // Try next selector
      }
    }

    console.log("[TikTokScraper] Could not find comment section, continuing anyway");
  }

  private async scrollAndCollect(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    let scrollAttempts = 0;
    let lastCommentCount = 0;
    let noNewCommentsCount = 0;

    while (
      scrollAttempts < (this.config.maxScrollAttempts || 50) &&
      this.comments.size < (this.config.maxComments || 1000)
    ) {
      // Check if cancelled
      if (this.abortController?.signal.aborted) {
        console.log("[TikTokScraper] Scraping cancelled");
        break;
      }

      // Scroll down
      await this.page.evaluate(() => {
        window.scrollBy(0, 800);
      });

      // Also try scrolling the comment container
      await this.page.evaluate(() => {
        const containers = document.querySelectorAll(
          '[data-e2e="comment-list"], [class*="CommentList"], [class*="comment-list"]',
        );
        containers.forEach((container) => {
          container.scrollTop = container.scrollHeight;
        });
      });

      // Wait for new content
      await this.page.waitForTimeout(this.config.scrollTimeout || 5000);

      // Check if we got new comments
      if (this.comments.size === lastCommentCount) {
        noNewCommentsCount++;
        if (noNewCommentsCount >= 3) {
          console.log("[TikTokScraper] No new comments after 3 attempts, stopping");
          break;
        }
      } else {
        noNewCommentsCount = 0;
      }

      lastCommentCount = this.comments.size;
      scrollAttempts++;

      // Update progress
      const progress = Math.min(85, 30 + (this.comments.size / (this.config.maxComments || 1000)) * 55);
      this.emitProgress("scrolling", progress, `Scrolling... Found ${this.comments.size} comments`);

      console.log(`[TikTokScraper] Scroll ${scrollAttempts}: ${this.comments.size} comments collected`);
    }
  }

  private async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  private isValidTikTokUrl(url: string): boolean {
    const patterns = [
      /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /^https?:\/\/(vm|vt)\.tiktok\.com\/[\w]+/,
      /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/,
    ];
    return patterns.some((pattern) => pattern.test(url));
  }

  private parseProxyUrl(proxy: string): { server: string; username?: string; password?: string } | null {
    try {
      // Handle different proxy formats
      // http://user:pass@host:port
      // http://host:port
      // host:port

      let proxyUrl = proxy.trim();

      // Add protocol if missing
      if (!proxyUrl.startsWith("http://") && !proxyUrl.startsWith("https://")) {
        proxyUrl = `http://${proxyUrl}`;
      }

      const url = new URL(proxyUrl);

      return {
        server: `${url.protocol}//${url.host}`,
        username: url.username || undefined,
        password: url.password || undefined,
      };
    } catch {
      console.error(`[TikTokScraper] Invalid proxy format: ${proxy}`);
      return null;
    }
  }

  private emitProgress(
    phase: "initializing" | "loading" | "scrolling" | "extracting" | "saving",
    progress: number,
    message: string,
  ): void {
    emitScrapeProgress(this.config.userId, {
      historyId: this.config.historyId,
      phase,
      progress: Math.round(progress),
      commentsFound: this.comments.size,
      message,
      timestamp: new Date(),
    });
  }
}

// ===========================================
// Factory Function
// ===========================================

export function createScraper(platform: Platform, config: ScrapeConfig): TikTokScraper {
  switch (platform) {
    case "TIKTOK":
      return new TikTokScraper(config);
    case "FACEBOOK":
      // TODO: Implement Facebook scraper
      throw new Error("Facebook scraper not yet implemented");
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
