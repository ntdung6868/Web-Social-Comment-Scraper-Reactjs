// ===========================================
// Facebook Scraper Engine (Playwright)
// ===========================================
// Ported from Python reference: DOM-based extraction
// Scroll container detection, burst scroll, junk filtering

import { chromium, type Browser, type BrowserContext, type Page, type ElementHandle } from "playwright";
import type { ScrapedComment } from "../../types/scraper.types.js";
import { emitScrapeProgress } from "../socket.js";
import { isJunkLine, extractFbUserId } from "../../utils/scraper.utils.js";

// ===========================================
// Types
// ===========================================

export interface FacebookScraperConfig {
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

const CAPTCHA_SELECTORS = [
  ".captcha-verify-container",
  "#captcha-verify-container-main-page",
  '[class*="captcha"]',
  '[id*="captcha"]',
  '[class*="Captcha"]',
];

// ===========================================
// Facebook Scraper Class
// ===========================================

export class FacebookScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: FacebookScraperConfig;
  private comments: Map<string, ScrapedComment> = new Map();
  private isRunning = false;
  private abortController: AbortController;

  constructor(config: FacebookScraperConfig) {
    this.config = { ...config, maxComments: config.maxComments || 1000 };
    this.abortController = new AbortController();
  }

  /**
   * Normalize sameSite cookie value to Playwright-compatible format.
   * Browser extensions export values like "no_restriction", "unspecified", etc.
   */
  static normalizeSameSite(value: unknown): "Strict" | "Lax" | "None" {
    if (!value || typeof value !== "string") return "Lax";
    const lower = value.toLowerCase().trim();
    if (lower === "strict") return "Strict";
    if (lower === "none" || lower === "no_restriction") return "None";
    return "Lax";
  }

  // ===========================================
  // Main Scrape Method
  // ===========================================

  async scrape(url: string): Promise<ScrapeResult> {
    this.isRunning = true;

    try {
      this.emitProgress("initializing", 0, "Đang khởi tạo trình duyệt...");
      console.log(`[Facebook] 🚀 Bắt đầu scrape: ${url}`);

      // Launch browser with 420px width (like Python reference)
      await this.launchBrowser();

      this.emitProgress("loading", 10, "Đang truy cập bài viết...");

      // Apply cookies if available
      if (this.config.cookies.data) {
        await this.applyCookies();
      } else {
        console.log("[Facebook] ⚠️ Chạy không cookie (Có thể cần đăng nhập)");
      }

      // Navigate to URL
      await this.navigateToUrl(url);

      // Check captcha
      await this.checkCaptcha();

      // Switch to "All comments" filter (very important!)
      await this.switchToAllComments();

      this.emitProgress("scrolling", 20, "Đang tải bình luận...");

      // Scroll to load comments section
      if (this.page) {
        await this.page.evaluate(() => window.scrollTo(0, 800));
        await this.page.waitForTimeout(500);
      }

      // Scroll to load all comments — burst scroll only, no clicking (like Python reference)
      await this.scrollToLoadComments();

      this.emitProgress("extracting", 80, "Đang trích xuất bình luận...");

      // Extract comments from DOM
      const results = await this.extractComments();

      this.emitProgress("saving", 95, `Hoàn thành! Tìm thấy ${results.length} bình luận`);
      console.log(`[Facebook] 🎉 Đã scrape được ${results.length} comment`);

      return {
        success: true,
        comments: results,
        totalComments: results.length,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định";
      console.error(`[Facebook] ❌ Error: ${msg}`);

      const partial = Array.from(this.comments.values());
      return {
        success: partial.length > 0,
        comments: partial,
        totalComments: partial.length,
        error: partial.length > 0 ? undefined : msg,
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
    const chromeArgs = [
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
      "--window-size=500,1000",
    ];

    if (this.config.headless) {
      chromeArgs.push("--headless=new");
    }

    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: false,
      args: chromeArgs,
    };

    // Add proxy if configured
    if (this.config.proxy) {
      const proxyConfig = this.parseProxyUrl(this.config.proxy);
      if (proxyConfig) {
        launchOptions.proxy = proxyConfig;
        console.log("[Facebook] 🌐 Đang sử dụng proxy");
      }
    }

    this.browser = await chromium.launch(launchOptions);

    const userAgent = this.config.cookies.userAgent || DEFAULT_USER_AGENT;

    // Create context WITHOUT viewport — use actual window size (like Python reference)
    // Python: maximize_window() → set_window_rect(width=420)
    // Playwright: viewport:null means page uses real window dimensions
    this.context = await this.browser.newContext({
      userAgent,
      viewport: null,
      locale: "vi-VN",
      timezoneId: "Asia/Ho_Chi_Minh",
    });

    // Hide webdriver property
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    this.page = await this.context.newPage();

    // Resize window to 500x1000 via CDP (like Python: set_window_rect)
    await this.resizeWindow(500, 1000);
  }

  // ===========================================
  // Cookie Application (ported from Python _apply_cookies)
  // ===========================================

  private async applyCookies(): Promise<void> {
    if (!this.context || !this.page || !this.config.cookies.data) return;

    try {
      console.log("[Facebook] 🍪 Đang nạp cookies...");

      // Navigate to facebook.com first to set domain (like Python reference)
      await this.page.goto("https://www.facebook.com", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await this.page.waitForTimeout(300);

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
          domain: String(c.domain || ".facebook.com"),
          path: String(c.path || "/"),
          secure: Boolean(c.secure),
        }));

      if (formattedCookies.length > 0) {
        // Batch add — much faster than one-by-one
        try {
          await this.context.addCookies(formattedCookies);
          console.log(`[Facebook] ✅ Đã nạp ${formattedCookies.length} cookies`);
        } catch {
          // Fallback: one-by-one if batch fails
          let added = 0;
          for (const cookie of formattedCookies) {
            try {
              await this.context.addCookies([cookie]);
              added++;
            } catch {
              // skip bad cookie
            }
          }
          console.log(`[Facebook] ✅ Đã nạp ${added}/${formattedCookies.length} cookies (fallback)`);
        }
        // Refresh to apply cookies
        await this.page.reload({ waitUntil: "domcontentloaded" });
        await this.page.waitForTimeout(500);
      }
    } catch (error) {
      console.warn("[Facebook] ⚠️ Không thể nạp cookies:", error);
    }
  }

  // ===========================================
  // Navigation
  // ===========================================

  private async navigateToUrl(url: string): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log("[Facebook] 🌍 Đang vào bài viết...");
    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await this.page.waitForTimeout(800);

    // Wait for page content to load
    const loadSelectors = ['div[role="article"]', 'div[role="main"]', 'div[data-pagelet="MainFeed"]', "div.x1yztbdb"];

    let pageLoaded = false;
    for (const selector of loadSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        console.log(`[Facebook] ✅ Trang đã load (selector: ${selector})`);
        pageLoaded = true;
        break;
      } catch {
        continue;
      }
    }

    if (!pageLoaded) {
      console.warn("[Facebook] ⚠️ Không tìm thấy container chính, tiếp tục...");
    }
  }

  // ===========================================
  // Captcha Detection (ported from Python)
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
      console.error("[Facebook] 🛑 PHÁT HIỆN CAPTCHA!");

      if (this.config.headless) {
        throw new Error("🔒 CAPTCHA FACEBOOK! Hãy lấy cookie từ trình duyệt thật hoặc tắt chế độ Headless.");
      } else {
        console.log("[Facebook] ⏳ Đang chờ bạn giải captcha...");
        const maxWait = 120000;
        let waited = 0;
        while (waited < maxWait) {
          if (!(await this.isCaptchaPresent())) {
            console.log("[Facebook] ✅ Captcha đã được giải! Tiếp tục...");
            await this.page!.waitForTimeout(2000);
            return;
          }
          await this.page!.waitForTimeout(3000);
          waited += 3000;
          if (waited % 15000 === 0) {
            console.log(`[Facebook] ⏳ Vẫn đang chờ captcha (${waited / 1000}s)...`);
          }
        }
        throw new Error("Captcha không được giải trong 120s. Vui lòng thử lại!");
      }
    }
  }

  // ===========================================
  // Switch to All Comments (ported from Python _switch_to_all_comments)
  // ===========================================

  private async switchToAllComments(): Promise<void> {
    if (!this.page) return;

    console.log("[Facebook] 🔄 Đang chuyển bộ lọc 'Tất cả bình luận'...");
    try {
      // Click the current filter button
      const filterBtn = this.page
        .locator('span:text-is("Phù hợp nhất"), span:text-is("Most relevant"), span:text-is("Most Relevant")')
        .first();

      if (await filterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await filterBtn.scrollIntoViewIfNeeded();
        await filterBtn.click({ force: true });
        await this.page.waitForTimeout(500);

        // Select "All comments"
        const allCommentsOption = this.page
          .locator('span:text-is("Tất cả bình luận"), span:text-is("All comments"), span:text-is("All Comments")')
          .first();

        if (await allCommentsOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await allCommentsOption.click({ force: true });
          console.log("[Facebook] ✅ Đã chuyển bộ lọc sang 'Tất cả bình luận'!");
          await this.page.waitForTimeout(800);
          return;
        }
      }

      console.log("[Facebook] ⚠️ Không tìm thấy bộ lọc (Có thể đã đúng sẵn)");
    } catch (error) {
      const msg = String(error);
      if (msg.includes("tab crashed") || msg.includes("session")) {
        console.warn("[Facebook] ⚠️ Tab gặp vấn đề, bỏ qua chuyển filter...");
      } else {
        console.warn("[Facebook] ⚠️ Không chuyển được bộ lọc, tiếp tục...");
      }
    }
  }

  // ===========================================
  // Find Scroll Container (ported from Python _find_fb_scroll_container)
  // ===========================================

  private async findScrollContainer(): Promise<ElementHandle | null> {
    if (!this.page) return null;

    try {
      // Find the scrollable element with biggest delta across ALL dialogs
      // Python uses find_element (first dialog only), but when there are multiple
      // dialogs (cookie consent, login prompt, post dialog), we must check all.
      const container = await this.page.evaluate(() => {
        let bestDelta = 0;
        let bestIndex = -1;
        const allDivs: Element[] = [];

        // Scan ALL dialogs (not just the first one)
        const dialogs = document.querySelectorAll('div[role="dialog"]');
        for (const dialog of dialogs) {
          const divs = dialog.querySelectorAll("div");
          divs.forEach((el) => {
            const sh = el.scrollHeight;
            const ch = el.clientHeight;
            const delta = sh - ch;
            allDivs.push(el);
            if (delta > 40 && delta > bestDelta) {
              bestDelta = delta;
              bestIndex = allDivs.length - 1;
            }
          });
        }

        // Fallback: Comment sections outside dialog
        if (bestIndex < 0) {
          const sections = document.querySelectorAll(
            'div[data-pagelet*="Comment"], div[aria-label*="Comment"], div[aria-label*="Bình luận"]',
          );
          sections.forEach((el: Element) => {
            const sh = el.scrollHeight;
            const ch = el.clientHeight;
            const delta = sh - ch;
            allDivs.push(el);
            if (delta > 40 && delta > bestDelta) {
              bestDelta = delta;
              bestIndex = allDivs.length - 1;
            }
          });
        }

        // Last fallback: any scrollable div on the page
        if (bestIndex < 0) {
          const allPageDivs = document.querySelectorAll("div");
          allPageDivs.forEach((el) => {
            const sh = el.scrollHeight;
            const ch = el.clientHeight;
            const delta = sh - ch;
            allDivs.push(el);
            if (delta > 200 && delta > bestDelta) {
              bestDelta = delta;
              bestIndex = allDivs.length - 1;
            }
          });
        }

        if (bestIndex >= 0) {
          const el = allDivs[bestIndex]!;
          el.setAttribute("data-fb-scroll-target", "true");
          return bestDelta;
        }
        return 0;
      });

      if (container && container > 0) {
        const el = await this.page.$('[data-fb-scroll-target="true"]');
        // Clean up marker
        await this.page
          .evaluate(() => {
            const marked = document.querySelector('[data-fb-scroll-target="true"]');
            if (marked) marked.removeAttribute("data-fb-scroll-target");
          })
          .catch(() => {});
        if (el) {
          console.log(`[Facebook] 🔎 Scroll container found (delta=${container})`);
          return el;
        }
      }
    } catch (error) {
      console.debug("[Facebook] Error finding scroll container:", error);
    }

    console.log("[Facebook] 🔎 Scroll container not found");
    return null;
  }

  // ===========================================
  // Burst Scroll (ported from Python _fb_scroll_burst)
  // ===========================================

  private async burstScroll(container: ElementHandle | null, burstCount = 15, intervalMs = 60): Promise<boolean> {
    if (!this.page) return false;

    // Python: if not container: return False — NO window fallback
    if (!container) {
      console.log("[Facebook] ⚡ Burst: no container, skip");
      return false;
    }

    try {
      // Scroll inside container (Python: arguments[0].scrollTop += step)
      const before = await container.evaluate((node) => {
        const el = node as HTMLElement;
        return { top: el.scrollTop, sh: el.scrollHeight, ch: el.clientHeight };
      });

      const step = Math.max(900, Math.floor(before.ch * 1.8));

      for (let i = 0; i < burstCount; i++) {
        await container
          .evaluate((node, s) => {
            const el = node as HTMLElement;
            el.scrollTop = el.scrollTop + s;
          }, step)
          .catch(() => {});
        if (intervalMs > 0) {
          await this.page!.waitForTimeout(intervalMs);
        }
      }

      const after = await container.evaluate((node) => {
        const el = node as HTMLElement;
        return { top: el.scrollTop, sh: el.scrollHeight };
      });

      const moved = after.top > before.top || after.sh > before.sh;
      console.log(
        `[Facebook] ⚡ Burst: moved=${moved} (top ${before.top}->${after.top}; sh ${before.sh}->${after.sh})`,
      );
      return moved;
    } catch (error) {
      console.debug("[Facebook] Burst scroll error:", error);
      return false;
    }
  }

  // ===========================================
  // Scroll to Load All Comments
  // ===========================================

  private async scrollToLoadComments(): Promise<void> {
    if (!this.page) return;

    // Matches Python: "Đang cuộn đến cuối (không click 'Xem thêm')..."
    // Only burst scroll + scroll up/down retry. No clicking.
    console.log("[Facebook] 📜 Đang cuộn đến cuối (không click 'Xem thêm')...");
    let noMoreScroll = 0;
    let containerCache: ElementHandle | null = null;
    let debugLogged = false;

    while (this.isRunning && !this.abortController.signal.aborted) {
      // Log dialog info once
      if (!debugLogged) {
        try {
          const dialogCount = await this.page.locator('div[role="dialog"]').count();
          console.log(`[Facebook] 🔎 Dialog count = ${dialogCount}`);
        } catch {
          // ignore
        }
        debugLogged = true;
      }

      // Find/cache scroll container
      if (!containerCache) {
        containerCache = await this.findScrollContainer();
      } else {
        const isValid = await containerCache.isVisible().catch(() => false);
        if (!isValid) {
          containerCache = await this.findScrollContainer();
        }
      }

      // Burst scroll (from Python _fb_scroll_burst)
      const canScroll = await this.burstScroll(containerCache, 15, 60);

      if (!canScroll) {
        noMoreScroll++;
        console.log(`[Facebook] ⏳ Không có data mới, retry ${noMoreScroll}/3...`);

        // Scroll up then down to trigger lazy load (from Python reference)
        if (noMoreScroll < 3 && containerCache) {
          await containerCache
            .evaluate((node) => {
              const el = node as HTMLElement;
              el.scrollTop = Math.max(0, el.scrollTop - 500);
            })
            .catch(() => {});
          await this.page.waitForTimeout(300);
          await containerCache
            .evaluate((node) => {
              const el = node as HTMLElement;
              el.scrollTop = el.scrollHeight;
            })
            .catch(() => {});
          await this.page.waitForTimeout(500);
        }
      } else {
        noMoreScroll = 0;
      }

      // Estimate progress
      const articleCount = await this.page
        .locator('div[role="article"]')
        .count()
        .catch(() => 0);
      const progress = Math.min(75, 20 + (articleCount / (this.config.maxComments || 1000)) * 55);
      this.emitProgress("scrolling", progress, `Đang cuộn... Phát hiện ~${articleCount} mục`);

      if (noMoreScroll >= 3) {
        console.log("[Facebook] 🛑 Đã cuộn tới cuối, bắt đầu quét comment...");
        break;
      }
    }
  }

  // ===========================================
  // Check if comment is a reply (ported from Python _is_fb_reply_comment)
  // ===========================================

  private async isReplyComment(element: ElementHandle): Promise<boolean> {
    try {
      return await element.evaluate((el) => {
        // Check for ancestor with reply-related aria-label
        let node: Element | null = el as unknown as Element;
        while (node) {
          const aria = node.getAttribute("aria-label") || "";
          if (
            aria.includes("Reply") ||
            aria.includes("Trả lời") ||
            aria.includes("replies") ||
            aria.includes("phản hồi")
          ) {
            return true;
          }
          node = node.parentElement;
        }
        return false;
      });
    } catch {
      return false;
    }
  }

  // ===========================================
  // Extract Comments from DOM (ported from Python scrape post-scroll extraction)
  // ===========================================

  private async extractComments(): Promise<ScrapedComment[]> {
    if (!this.page) return [];

    const results: ScrapedComment[] = [];
    const seen = new Set<string>();

    try {
      // Find container (dialog or page)
      let containerLocator = this.page.locator('div[role="dialog"]').first();
      if (!(await containerLocator.isVisible({ timeout: 2000 }).catch(() => false))) {
        containerLocator = this.page.locator("body");
      }

      // Find all comment items
      const articles = await containerLocator.locator('div[role="article"]').all();
      console.log(`[Facebook] 🔍 Tìm thấy ${articles.length} article elements`);

      for (const article of articles) {
        try {
          // Skip reply comments (level 2+) - only get level 1 (from Python reference)
          const articleHandle = await article.elementHandle();
          if (articleHandle && (await this.isReplyComment(articleHandle))) {
            continue;
          }

          // --- Extract User ID from links (from Python reference) ---
          let userId = "Unknown";
          try {
            const links = await article.locator("a").all();
            for (const link of links) {
              const href = await link.getAttribute("href").catch(() => null);
              if (!href) continue;

              // Skip system links
              if (
                ["/hashtag/", "sharer.php", "l.php", "/posts/", "/videos/", "/watch/"].some((x) => href.includes(x))
              ) {
                continue;
              }

              const extracted = extractFbUserId(href);
              if (extracted !== "Unknown") {
                userId = extracted;
                break;
              }
            }
          } catch {
            // userId stays "Unknown"
          }

          // --- Extract emoji text from img[alt] in div[dir='auto'] (from Python reference) ---
          let emojiText = "";
          try {
            const contentDiv = article.locator("div[dir='auto']").first();
            if (await contentDiv.isVisible({ timeout: 500 }).catch(() => false)) {
              const imgs = await contentDiv.locator("img").all();
              for (const img of imgs) {
                const alt = await img.getAttribute("alt").catch(() => null);
                if (alt) emojiText += alt + " ";
              }
            }
          } catch {
            // ignore
          }

          // --- Extract raw text and filter junk lines (from Python reference) ---
          const rawText = await article.innerText().catch(() => "");
          if (!rawText.trim() && !emojiText.trim()) continue;

          const allLines = rawText.split("\n");
          const cleanLines = allLines.filter((line) => !isJunkLine(line));

          // --- LOGIC FIX: Facebook always puts [Line 1: Name] [Line 2+: Content] ---
          // (Directly from Python reference)
          let commentContent = "";
          if (cleanLines.length >= 2) {
            // 2+ lines -> Line 1 is name -> Take from line 2
            commentContent = cleanLines.slice(1).join("\n");
          } else if (cleanLines.length === 1) {
            // Only 1 line -> 99% that's the user name (content is empty or just image)
            commentContent = "";
          }

          // Combine text with emoji
          const finalContent = (commentContent + " " + emojiText).trim();

          // If empty after filtering, label as image/sticker
          const displayContent = finalContent || "[Ảnh/Sticker/GIF]";

          // --- Extract Likes (from Python reference - multiple strategies) ---
          let likes = 0;
          try {
            // Strategy 1: aria-label containing like count
            const likeElements = await article
              .locator(
                '[aria-label*="like" i], [aria-label*="thích" i], [aria-label*="reaction" i], [aria-label*="cảm xúc" i]',
              )
              .all();
            for (const el of likeElements) {
              const aria = (await el.getAttribute("aria-label")) || "";
              const match = aria.match(/(\d+)/);
              if (match && match[1]) {
                likes = parseInt(match[1], 10);
                break;
              }
            }

            // Strategy 2: Button with small number text
            if (likes === 0) {
              const reactionSpans = await article.locator('div[role="button"] span, span[role="button"] span').all();
              for (const span of reactionSpans) {
                const txt = ((await span.textContent().catch(() => "")) || "").trim();
                if (txt && /^\d+$/.test(txt) && txt.length <= 5) {
                  likes = parseInt(txt, 10);
                  break;
                }
              }
            }

            // Strategy 3: Small text numbers near end of comment
            if (likes === 0) {
              const smallTexts = await article.locator("span").all();
              for (const span of smallTexts) {
                const txt = ((await span.textContent().catch(() => "")) || "").trim();
                if (txt && /^\d+$/.test(txt) && parseInt(txt, 10) > 0 && parseInt(txt, 10) < 10000) {
                  // Check it's not a timestamp by looking at parent text
                  const parentText = await span
                    .evaluate((el) => el.parentElement?.textContent?.toLowerCase() || "")
                    .catch(() => "");
                  const timeWords = ["giờ", "phút", "ngày", "tuần", "h ", "m ", "d ", "w "];
                  if (!timeWords.some((w) => parentText.includes(w))) {
                    likes = parseInt(txt, 10);
                    break;
                  }
                }
              }
            }
          } catch {
            // likes stays 0
          }

          // --- Deduplicate by (username, content) (from Python reference) ---
          const uniqueKey = `${userId}||${displayContent}`;
          if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey);
            results.push({
              username: userId,
              content: displayContent,
              timestamp: null,
              likes,
            });

            // Log preview
            const likesStr = likes > 0 ? ` [${likes} ❤️]` : "";
            const short = displayContent.substring(0, 30).replace(/\n/g, " ");
            console.log(`[Facebook]    + ${userId}: ${short}...${likesStr}`);
          }
        } catch {
          continue;
        }
      }

      if (results.length > 0) {
        console.log(`[Facebook] ✅ Trích xuất ${results.length} comment từ DOM`);
        this.emitProgress("extracting", 90, `Đã trích xuất ${results.length} bình luận`);
      }
    } catch (error) {
      console.error("[Facebook] Lỗi trích xuất DOM:", error);
    }

    return results;
  }

  // ===========================================
  // Helper Methods
  // ===========================================

  private parseProxyUrl(proxy: string): { server: string; username?: string; password?: string } | undefined {
    try {
      const proxyUrl = proxy.startsWith("http") ? proxy : `http://${proxy}`;
      const url = new URL(proxyUrl);
      return {
        server: `${url.protocol}//${url.hostname}:${url.port}`,
        username: url.username || undefined,
        password: url.password || undefined,
      };
    } catch {
      return undefined;
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

  /**
   * Resize browser window via CDP (like Python: set_window_rect(width=420)).
   * Playwright viewport only sets content area; CDP sets the actual window.
   */
  private async resizeWindow(width: number, height: number): Promise<void> {
    if (!this.page) return;
    try {
      const cdp = await this.page.context().newCDPSession(this.page);
      const { windowId } = await cdp.send("Browser.getWindowForTarget");
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: { left: 0, top: 0, width, height, windowState: "normal" },
      });
      console.log(`[Facebook] 📐 Window resized to ${width}x${height} via CDP`);
    } catch (err) {
      console.debug("[Facebook] CDP resize failed (headless?), relying on --window-size arg:", err);
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
}
