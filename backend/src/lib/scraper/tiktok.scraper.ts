// ===========================================
// TikTok Scraper Engine (Playwright)
// ===========================================
// Ported from Python reference: DOM-based extraction + API interception
// Uses Playwright instead of Selenium for better Node.js integration

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { ScrapedComment } from "../../types/scraper.types.js";
import { emitScrapeProgress } from "../socket.js";

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

export interface ScrapeConfig {
  userId: number;
  historyId: number;
  cookies: { data: string | null; userAgent: string | null };
  proxy: string | null;
  headless: boolean;
  maxComments?: number;
}

export interface ScrapeResult {
  success: boolean;
  comments: ScrapedComment[];
  totalComments: number;
  error?: string;
}

// ===========================================
// Constants
// ===========================================

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TIKTOK_COMMENT_API_PATTERNS = [
  /api.*\/comment\/list/,
  /api.*\/comment\/reply\/list/,
  /comment\/list/,
  /webcast.*comment/,
];

const CAPTCHA_SELECTORS = [
  ".captcha-verify-container",
  "#captcha-verify-container-main-page",
  '[class*="captcha"]',
  '[id*="captcha"]',
  ".secsdk-captcha-drag-wrapper",
  '[class*="Captcha"]',
  'div[data-testid="captcha"]',
];

// ===========================================
// TikTok Scraper Class
// ===========================================

export class TikTokScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: ScrapeConfig;
  // API interception map (cid -> comment) as bonus data source
  private apiComments: Map<string, ScrapedComment> = new Map();
  private isRunning = false;
  private abortController: AbortController;

  constructor(config: ScrapeConfig) {
    this.config = {
      maxComments: 1000,
      ...config,
    };
    this.abortController = new AbortController();
  }

  /**
   * Normalize sameSite cookie value to Playwright-compatible format.
   * Browser extensions export values like "no_restriction", "unspecified", "lax", etc.
   * Playwright only accepts "Strict" | "Lax" | "None".
   */
  static normalizeSameSite(value: unknown): "Strict" | "Lax" | "None" {
    if (!value || typeof value !== "string") return "Lax";
    const lower = value.toLowerCase().trim();
    if (lower === "strict") return "Strict";
    if (lower === "none" || lower === "no_restriction") return "None";
    // "lax", "unspecified", or anything else → Lax
    return "Lax";
  }

  // ===========================================
  // Main Scrape Method
  // ===========================================

  async scrape(url: string): Promise<ScrapeResult> {
    this.isRunning = true;

    try {
      // Validate URL
      if (!this.isValidTikTokUrl(url)) {
        throw new Error("URL TikTok không hợp lệ");
      }

      this.emitProgress("initializing", 0, "Đang khởi tạo trình duyệt...");
      console.log(`[TikTok] 🚀 Bắt đầu scrape: ${url}`);

      // Launch browser with 420px width (like Python reference)
      await this.launchBrowser();

      this.emitProgress("loading", 10, "Đang truy cập trang...");

      // Apply cookies first if available (navigate to tiktok.com -> apply -> navigate to URL)
      if (this.config.cookies.data) {
        await this.applyCookies();
      }

      // Navigate to video URL
      await this.navigateToUrl(url);

      // Check for captcha
      await this.checkCaptcha();

      this.emitProgress("loading", 20, "Đang mở bình luận...");

      // Click comment button to open comment panel
      await this.clickCommentButton();
      await this.randomSleep(1500, 2500);
      // Wait for comments to stabilize
      await this.page!.waitForTimeout(1200);

      // Check captcha again after interaction
      await this.checkCaptcha();

      this.emitProgress("scrolling", 25, "Đang cuộn để tải bình luận...");

      // Scroll to load all comments (burst scroll like Python reference)
      await this.scrollToLoadComments();

      this.emitProgress("extracting", 75, "Đang trích xuất bình luận...");

      // Extract comments from DOM (primary method - like Python reference)
      const domComments = await this.extractCommentsFromDOM();

      // Merge API-intercepted comments with DOM-extracted comments
      const allComments = this.mergeComments(domComments);

      this.emitProgress("saving", 95, `Hoàn thành! Tìm thấy ${allComments.length} bình luận`);
      console.log(`[TikTok] 🎉 Đã scrape được ${allComments.length} comment`);

      return {
        success: true,
        comments: allComments,
        totalComments: allComments.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định";
      console.error(`[TikTok] ❌ Error: ${errorMessage}`);

      // Return whatever we have collected so far
      const partialComments = Array.from(this.apiComments.values());
      return {
        success: partialComments.length > 0,
        comments: partialComments,
        totalComments: partialComments.length,
        error: partialComments.length > 0 ? undefined : errorMessage,
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
    this.abortController.abort();
    this.isRunning = false;
  }

  // ===========================================
  // Browser Setup (ported from Python _setup_driver)
  // ===========================================

  private async launchBrowser(): Promise<void> {
    // Chrome args matching Python reference _setup_driver() for anti-detection
    const launchArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-notifications",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--shm-size=2g",
      // Stability flags (from Python reference)
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-component-extensions-with-background-pages",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-hang-monitor",
      "--disable-ipc-flooding-protection",
      "--disable-popup-blocking",
      "--disable-prompt-on-repost",
      "--disable-renderer-backgrounding",
      "--disable-sync",
      "--disable-translate",
      "--metrics-recording-only",
      "--no-first-run",
      "--safebrowsing-disable-auto-update",
      "--enable-features=NetworkService,NetworkServiceInProcess",
      "--force-color-profile=srgb",
      "--memory-pressure-off",
      "--disable-features=TranslateUI,VizDisplayCompositor",
      "--js-flags=--max-old-space-size=512",
      "--disable-software-rasterizer",
      "--window-size=1920,1080",
    ];

    // CRITICAL: When headless is requested, use full Chromium with --headless=new
    // instead of letting Playwright auto-select Chrome Headless Shell.
    // The headless shell is easily fingerprinted by TikTok / Facebook bot-detection.
    if (this.config.headless) {
      launchArgs.push("--headless=new");
    }

    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      // Always set headless: false so Playwright uses the FULL Chromium binary.
      // Our --headless=new flag above handles actual headless rendering.
      headless: false,
      args: launchArgs,
    };

    // Add proxy if configured
    if (this.config.proxy) {
      const proxyConfig = this.parseProxyUrl(this.config.proxy);
      if (proxyConfig) {
        launchOptions.proxy = proxyConfig;
        console.log("[TikTok] 🌐 Đang sử dụng proxy");
      }
    }

    this.browser = await chromium.launch(launchOptions);

    const userAgent = this.config.cookies.userAgent || DEFAULT_USER_AGENT;

    // Create context with 500px width (narrow viewport like Python reference's 420px)
    this.context = await this.browser.newContext({
      userAgent,
      viewport: { width: 500, height: 900 },
      locale: "vi-VN",
      timezoneId: "Asia/Ho_Chi_Minh",
    });

    // Hide webdriver property (like Python reference)
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    this.page = await this.context.newPage();

    // Set up API response interception (bonus data source)
    this.setupResponseInterception();
  }

  // ===========================================
  // Cookie Application (ported from Python _apply_cookies)
  // ===========================================

  private async applyCookies(): Promise<void> {
    if (!this.context || !this.page || !this.config.cookies.data) return;

    try {
      console.log("[TikTok] 🍪 Đang apply cookies...");

      // Navigate to tiktok.com first to set domain (like Python reference)
      await this.page.goto("https://www.tiktok.com", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await this.randomSleep(2000, 3000);

      const cookies = JSON.parse(this.config.cookies.data);
      const cookieList = Array.isArray(cookies) ? cookies : cookies.cookies || [];

      // Clear existing cookies first (like Python: driver.delete_all_cookies())
      await this.context.clearCookies();

      // Format cookies EXACTLY like Python reference: only name, value, domain, path, secure
      // Python _apply_cookies only passes these 5 fields — simpler = fewer errors
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedCookies = cookieList
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => c.name && c.value)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => ({
          name: String(c.name),
          value: String(c.value),
          domain: String(c.domain || ".tiktok.com"),
          path: String(c.path || "/"),
          secure: Boolean(c.secure),
        }));

      if (formattedCookies.length > 0) {
        // Add cookies one-by-one to skip invalid ones instead of failing the whole batch
        let added = 0;
        for (const cookie of formattedCookies) {
          try {
            await this.context.addCookies([cookie]);
            added++;
          } catch (e) {
            console.warn(`[TikTok] ⚠️ Cookie bị lỗi (${cookie.name}):`, e);
          }
        }
        console.log(`[TikTok] ✅ Đã apply ${added}/${formattedCookies.length} cookies`);
      }
    } catch (error) {
      console.warn("[TikTok] ⚠️ Không thể apply cookies:", error);
    }
  }

  // ===========================================
  // Navigation
  // ===========================================

  private async navigateToUrl(url: string): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log("[TikTok] 🌍 Đang truy cập trang...");
    // Python reference uses driver.get(url) + _random_sleep(2.5, 4.0)
    // NOT networkidle (which can hang or timeout)
    await this.page.goto(url, {
      waitUntil: "load",
      timeout: 45000,
    });
    await this.randomSleep(2500, 4000);

    // Log debug info
    try {
      const title = await this.page.title();
      console.log(`[TikTok] 📄 Page title: ${title}`);
      console.log(`[TikTok] 📍 URL: ${this.page.url()}`);
    } catch {
      // ignore
    }
  }

  // ===========================================
  // Captcha Detection (ported from Python _is_captcha_present / _wait_for_captcha_if_present)
  // ===========================================

  private async isCaptchaPresent(): Promise<boolean> {
    if (!this.page) return false;

    try {
      for (const selector of CAPTCHA_SELECTORS) {
        const element = await this.page.$(selector);
        if (element) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  private async checkCaptcha(): Promise<void> {
    if (await this.isCaptchaPresent()) {
      console.error("[TikTok] 🛑 PHÁT HIỆN CAPTCHA!");

      if (this.config.headless) {
        // Headless mode: throw immediately (like Python reference)
        throw new Error("🔒 CAPTCHA TIKTOK! Hãy lấy cookie từ trình duyệt thật hoặc tắt chế độ Headless.");
      } else {
        // Non-headless: wait for user to solve (like Python reference)
        console.log("[TikTok] ⏳ Đang chờ bạn giải captcha...");
        const maxWait = 120000; // 120 seconds
        let waited = 0;
        while (waited < maxWait) {
          if (!(await this.isCaptchaPresent())) {
            console.log("[TikTok] ✅ Captcha đã được giải! Tiếp tục...");
            await this.page!.waitForTimeout(2000);
            return;
          }
          await this.page!.waitForTimeout(3000);
          waited += 3000;
          if (waited % 15000 === 0) {
            console.log(`[TikTok] ⏳ Vẫn đang chờ captcha (${waited / 1000}s)...`);
          }
        }
        throw new Error("Captcha không được giải trong 120s. Vui lòng thử lại!");
      }
    }
  }

  // ===========================================
  // Click Comment Button (ported from Python _click_comment_button)
  // ===========================================

  private async clickCommentButton(): Promise<void> {
    if (!this.page) return;

    console.log("[TikTok] ⏳ Đang tìm nút bình luận...");

    // Selectors for comment button (from Python reference _click_comment_button)
    // Python uses XPath with ancestor::button to find the clickable button ancestor
    const selectors = [
      "div#column-list-container button[aria-label*='comment' i]",
      "span[data-e2e='comment-icon']",
      "strong[data-e2e='comment-count']",
      "[data-e2e='comment-icon']",
      "span[class*='xgplayer-icon-comment']",
    ];

    // Pass 1: Quick check (no long waits) — like Python's fast pass
    for (const selector of selectors) {
      try {
        const el = await this.page.$(selector);
        if (!el) continue;
        const visible = await el.isVisible().catch(() => false);
        if (!visible) continue;

        // Navigate up to find the ancestor <button> (like Python ancestor::button)
        const btn = await el.evaluate((node) => {
          let current: HTMLElement | null = node as HTMLElement;
          for (let i = 0; i < 5; i++) {
            if (current?.tagName?.toLowerCase() === "button") return true;
            current = current?.parentElement || null;
          }
          return false;
        });

        // Scroll into view and JS click (like Python: execute_script("arguments[0].click()"))
        await el.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(300);
        if (btn) {
          // Click the ancestor button via JS
          await el.evaluate((node) => {
            let current: HTMLElement | null = node as HTMLElement;
            for (let i = 0; i < 5; i++) {
              if (current?.tagName?.toLowerCase() === "button") {
                current.click();
                return;
              }
              current = current?.parentElement || null;
            }
            // Fallback: click the element itself
            (node as HTMLElement).click();
          });
        } else {
          await el.evaluate((node) => (node as HTMLElement).click());
        }
        console.log(`[TikTok] ✅ Đã click mở bình luận (selector: ${selector})`);
        return;
      } catch {
        continue;
      }
    }

    // Pass 2: Slow check with waits — like Python's WebDriverWait pass
    for (const selector of selectors) {
      try {
        const el = await this.page.waitForSelector(selector, { timeout: 3000, state: "visible" });
        if (!el) continue;
        await el.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(300);
        await el.evaluate((node) => (node as HTMLElement).click());
        console.log(`[TikTok] ✅ Đã click mở bình luận [pass 2] (selector: ${selector})`);
        return;
      } catch {
        continue;
      }
    }

    // No button found - comments may already be visible (TikTok photo) — Python returns True here too
    console.log("[TikTok] ℹ️ Không cần click nút bình luận (đã hiển thị sẵn)");
  }

  // ===========================================
  // Burst Scroll (ported from Python _tiktok_scroll_burst)
  // ===========================================

  private async burstScroll(burstCount = 15, intervalMs = 60): Promise<boolean> {
    if (!this.page) return false;

    try {
      const beforeTop = await this.page.evaluate(() => window.pageYOffset || document.documentElement.scrollTop || 0);
      const beforeHeight = await this.page.evaluate(() => document.body.scrollHeight);

      for (let i = 0; i < burstCount; i++) {
        await this.page.evaluate(() => window.scrollBy(0, 1200));
        if (intervalMs > 0) {
          await this.page.waitForTimeout(intervalMs);
        }
      }

      const afterTop = await this.page.evaluate(() => window.pageYOffset || document.documentElement.scrollTop || 0);
      const afterHeight = await this.page.evaluate(() => document.body.scrollHeight);

      const moved = afterTop > beforeTop || afterHeight > beforeHeight;
      console.log(
        `[TikTok] ⚡ Burst: moved=${moved} (top ${beforeTop}->${afterTop}; h ${beforeHeight}->${afterHeight})`,
      );
      return moved;
    } catch (error) {
      console.debug("[TikTok] Burst scroll error:", error);
      return false;
    }
  }

  // ===========================================
  // Scroll to Load All Comments
  // ===========================================

  private async scrollToLoadComments(): Promise<void> {
    if (!this.page) return;

    console.log("[TikTok] 📜 Đang cuộn liên tục đến cuối...");
    let noMoreScroll = 0;

    while (this.isRunning && !this.abortController.signal.aborted) {
      // Check captcha periodically
      if (await this.isCaptchaPresent()) {
        await this.checkCaptcha();
      }

      const hasMore = await this.burstScroll(15, 60);
      if (!hasMore) {
        noMoreScroll++;
        console.log(`[TikTok] ⏳ Không có data mới, retry ${noMoreScroll}/3...`);

        // Trick: scroll up then down to trigger load (from Python reference)
        if (noMoreScroll < 3) {
          await this.page.evaluate(() => window.scrollBy(0, -500));
          await this.page.waitForTimeout(500);
          await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await this.page.waitForTimeout(1000);
        }
      } else {
        noMoreScroll = 0;
      }

      // Update progress based on API-intercepted comment count
      const apiCount = this.apiComments.size;
      if (apiCount > 0) {
        const progress = Math.min(70, 25 + (apiCount / (this.config.maxComments || 1000)) * 45);
        this.emitProgress("scrolling", progress, `Đang cuộn... Tìm thấy ${apiCount} bình luận`);
      }

      if (noMoreScroll >= 3) {
        console.log("[TikTok] 🛑 Đã cuộn tới cuối, bắt đầu quét comment...");
        break;
      }
    }
  }

  // ===========================================
  // API Response Interception (bonus data source)
  // ===========================================

  private setupResponseInterception(): void {
    if (!this.page) return;

    this.page.on("response", async (response) => {
      const url = response.url();
      const isCommentApi = TIKTOK_COMMENT_API_PATTERNS.some((p) => p.test(url));

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
      if (!this.apiComments.has(comment.cid)) {
        this.apiComments.set(comment.cid, {
          username: comment.user?.unique_id ? `@${comment.user.unique_id}` : comment.user?.nickname || "Unknown",
          content: comment.text || "",
          timestamp: comment.create_time ? new Date(comment.create_time * 1000).toISOString() : null,
          likes: comment.digg_count || 0,
        });

        // Process replies
        if (comment.reply_comment && Array.isArray(comment.reply_comment)) {
          for (const reply of comment.reply_comment) {
            if (!this.apiComments.has(reply.cid)) {
              this.apiComments.set(reply.cid, {
                username: reply.user?.unique_id ? `@${reply.user.unique_id}` : reply.user?.nickname || "Unknown",
                content: reply.text || "",
                timestamp: reply.create_time ? new Date(reply.create_time * 1000).toISOString() : null,
                likes: reply.digg_count || 0,
              });
            }
          }
        }
      }
    }
  }

  // ===========================================
  // DOM-based Comment Extraction (ported from Python post-scroll extraction)
  // ===========================================

  // All known selectors for TikTok comment items (ordered by reliability)
  private static readonly COMMENT_SELECTORS = [
    '[data-e2e="comment-level-1"]',
    '[class*="CommentItemContainer"]',
    '[class*="comment-item"]',
    '[class*="DivCommentItemContainer"]',
    '[class*="CommentListContainer"] > div > div',
  ];

  private async extractCommentsFromDOM(): Promise<ScrapedComment[]> {
    if (!this.page) return [];

    const comments: ScrapedComment[] = [];
    const seen = new Set<string>();

    try {
      // Try each selector until we find comment elements
      let commentElements: Awaited<ReturnType<Page["$$"]>> = [];
      let matchedSelector = "";

      for (const selector of TikTokScraper.COMMENT_SELECTORS) {
        try {
          // Wait briefly for the selector to appear
          await this.page.waitForSelector(selector, { timeout: 5000 }).catch(() => null);
          const found = await this.page.$$(selector);
          if (found.length > 0) {
            commentElements = found;
            matchedSelector = selector;
            break;
          }
        } catch {
          continue;
        }
      }

      console.log(
        `[TikTok] 🔍 Tìm thấy ${commentElements.length} comment elements trong DOM` +
          (matchedSelector ? ` (selector: ${matchedSelector})` : " (không tìm thấy selector nào)"),
      );

      // DEBUG: If 0 comments found, dump page info for troubleshooting
      if (commentElements.length === 0) {
        await this.dumpDebugInfo();
      }

      for (const element of commentElements) {
        try {
          // Get comment text
          const commentText = await element.innerText().catch(() => "");
          if (!commentText.trim()) continue;

          // Extract user ID from ancestor link containing '@' (from Python reference)
          let userId = "Unknown";
          try {
            const userLink = await element.evaluate((el) => {
              // Look in parent/ancestor containers for a link with @
              let node: Element | null = el;
              for (let i = 0; i < 3; i++) {
                node = node?.parentElement || null;
                if (!node) break;
                const links = node.querySelectorAll('a[href*="@"]');
                for (const link of links) {
                  const href = link.getAttribute("href");
                  if (href && href.includes("@")) return href;
                }
              }
              // Also try preceding sibling links
              const prevLinks = el.parentElement?.querySelectorAll('a[href*="@"]');
              if (prevLinks) {
                for (const link of prevLinks) {
                  const href = link.getAttribute("href");
                  if (href && href.includes("@")) return href;
                }
              }
              return null;
            });

            if (userLink) {
              userId = this.extractUserIdFromUrl(userLink);
            }
          } catch {
            // Keep userId as "Unknown"
          }

          // Extract likes count (from Python reference)
          let likes = 0;
          try {
            likes = await element.evaluate((el) => {
              // Search in parent containers for like count
              const searchContexts: Element[] = [];
              if (el.parentElement) searchContexts.push(el.parentElement);
              if (el.parentElement?.parentElement) searchContexts.push(el.parentElement.parentElement);

              for (const ctx of searchContexts) {
                // Method 1: aria-label containing "like"
                const likeContainer = ctx.querySelector('div[aria-label*="like" i], div[class*="LikeContainer"]');
                if (likeContainer) {
                  const ariaLabel = likeContainer.getAttribute("aria-label") || "";
                  const match = ariaLabel.match(/(\d+)\s*like/i);
                  if (match && match[1]) return parseInt(match[1], 10);

                  const span = likeContainer.querySelector("span");
                  if (span?.textContent?.trim()) {
                    const text = span.textContent.trim().toUpperCase();
                    if (text.includes("K")) return Math.floor(parseFloat(text.replace("K", "")) * 1000);
                    if (text.includes("M")) return Math.floor(parseFloat(text.replace("M", "")) * 1000000);
                    const num = parseInt(text.replace(/[^\d]/g, ""), 10);
                    if (!isNaN(num)) return num;
                  }
                }

                // Method 2: data-e2e selectors
                const selectors = [
                  "[data-e2e='comment-like-count']",
                  "div[class*='LikeContainer'] span",
                  "span[class*='LikeCount']",
                ];
                for (const sel of selectors) {
                  const found = ctx.querySelector(sel);
                  if (found?.textContent?.trim()) {
                    const text = found.textContent.trim().toUpperCase();
                    if (text.includes("K")) return Math.floor(parseFloat(text.replace("K", "")) * 1000);
                    if (text.includes("M")) return Math.floor(parseFloat(text.replace("M", "")) * 1000000);
                    const num = parseInt(text.replace(/[^\d]/g, ""), 10);
                    if (!isNaN(num)) return num;
                  }
                }
              }
              return 0;
            });
          } catch {
            // likes stays 0
          }

          // Deduplicate by (username, content) like Python reference
          const uniqueKey = `${userId}||${commentText.trim()}`;
          if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey);
            comments.push({
              username: userId,
              content: commentText.trim(),
              timestamp: null, // Skip timestamp for speed (like Python reference)
              likes,
            });

            // Log preview
            const short = commentText.trim().substring(0, 40).replace(/\n/g, " ");
            console.log(`[TikTok]    + ${userId}: ${short}...`);
          }
        } catch {
          continue;
        }
      }

      if (comments.length > 0) {
        console.log(`[TikTok] ✅ Trích xuất ${comments.length} comment từ DOM`);
        this.emitProgress("extracting", 85, `Đã trích xuất ${comments.length} bình luận từ DOM`);
      }
    } catch (error) {
      console.error("[TikTok] Lỗi trích xuất DOM:", error);
    }

    return comments;
  }

  // ===========================================
  // Merge Comments from API interception + DOM extraction
  // ===========================================

  private mergeComments(domComments: ScrapedComment[]): ScrapedComment[] {
    // If API interception captured comments, use those as primary (more accurate data)
    // Then add any DOM-only comments that weren't captured by API
    if (this.apiComments.size > 0) {
      const merged = new Map<string, ScrapedComment>();

      // Add API comments first (higher quality - has timestamp, exact likes, user ID)
      for (const [, comment] of this.apiComments) {
        const key = `${comment.username}||${comment.content}`;
        merged.set(key, comment);
      }

      // Add DOM comments that don't exist in API data
      for (const comment of domComments) {
        const key = `${comment.username}||${comment.content}`;
        if (!merged.has(key)) {
          merged.set(key, comment);
        }
      }

      const result = Array.from(merged.values());
      console.log(
        `[TikTok] 📊 Merged: ${this.apiComments.size} API + ${domComments.length} DOM = ${result.length} unique`,
      );
      return result;
    }

    // No API data available, use DOM data only
    return domComments;
  }

  // ===========================================
  // Helper Methods
  // ===========================================

  /**
   * Extract @username from URL (ported from Python _extract_userid_from_url)
   */
  private extractUserIdFromUrl(url: string): string {
    try {
      if (url.includes("@")) {
        const part = url.split("@")[1];
        if (part) return `@${part.split("?")[0]?.split("/")[0] ?? part}`;
      }
    } catch {
      // ignore
    }
    return "Unknown";
  }

  /**
   * Random sleep to mimic human behavior (ported from Python _random_sleep)
   */
  private async randomSleep(minMs: number, maxMs: number): Promise<void> {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isValidTikTokUrl(url: string): boolean {
    const patterns = [
      /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/photo\/\d+/,
      /^https?:\/\/(vm|vt)\.tiktok\.com\/[\w]+/,
      /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/,
    ];
    return patterns.some((pattern) => pattern.test(url));
  }

  private parseProxyUrl(proxy: string): { server: string; username?: string; password?: string } | null {
    try {
      let proxyUrl = proxy.trim();
      if (
        !proxyUrl.startsWith("http://") &&
        !proxyUrl.startsWith("https://") &&
        !proxyUrl.startsWith("socks4://") &&
        !proxyUrl.startsWith("socks5://")
      ) {
        proxyUrl = `http://${proxyUrl}`;
      }
      const url = new URL(proxyUrl);
      return {
        server: `${url.protocol}//${url.host}`,
        username: url.username || undefined,
        password: url.password || undefined,
      };
    } catch {
      console.error(`[TikTok] Invalid proxy format: ${proxy}`);
      return null;
    }
  }

  /**
   * Dump page debug info when scraping finds 0 comments.
   * Logs page HTML snippet and saves a debug screenshot.
   */
  private async dumpDebugInfo(): Promise<void> {
    if (!this.page) return;

    try {
      // Log a snippet of the page HTML (first 2000 chars) to reveal what TikTok served
      const htmlSnippet = await this.page.evaluate(() => document.documentElement.outerHTML.substring(0, 2000));
      console.warn("[TikTok] ⚠️ DEBUG: 0 comments found. Page HTML snippet:");
      console.warn(htmlSnippet);

      // Check for common block indicators
      const currentUrl = this.page.url();
      const title = await this.page.title();
      console.warn(`[TikTok] ⚠️ DEBUG: URL=${currentUrl}  Title=${title}`);

      // Check if we're on a login/block page
      const bodyText = await this.page.evaluate(() => document.body?.innerText?.substring(0, 500) || "");
      if (
        bodyText.toLowerCase().includes("log in") ||
        bodyText.toLowerCase().includes("sign up") ||
        bodyText.toLowerCase().includes("verify")
      ) {
        console.warn("[TikTok] ⚠️ Detected login/verification wall. Cookie might be needed.");
      }

      // Try to save screenshot (non-critical — swallow errors)
      try {
        const path = `/tmp/tiktok-debug-${this.config.historyId}-${Date.now()}.png`;
        await this.page.screenshot({ path, fullPage: true });
        console.warn(`[TikTok] 📸 Debug screenshot saved: ${path}`);
      } catch {
        // ignore screenshot failures
      }
    } catch (e) {
      console.warn("[TikTok] Could not dump debug info:", e);
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
      commentsFound: this.apiComments.size,
      message,
      timestamp: new Date(),
    });
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
}
