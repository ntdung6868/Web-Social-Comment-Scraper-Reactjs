// src/lib/scraper/facebook.scraper.ts

import { chromium, Browser, BrowserContext, Page, ElementHandle } from "playwright";
import { ScrapedComment } from "../../types/scraper.types.js";
import { parseCount, isJunkLine, extractFbUserId } from "../../utils/scraper.utils.js";
import { emitScrapeProgress } from "../socket.js";

interface FacebookScraperConfig {
  userId: number;
  historyId: number;
  cookies: { data: string | null; userAgent: string | null };
  proxy: string | null;
  headless: boolean;
  maxComments?: number;
}

export class FacebookScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: FacebookScraperConfig;
  private comments: Map<string, ScrapedComment> = new Map();
  private isRunning = false;

  constructor(config: FacebookScraperConfig) {
    this.config = { ...config, maxComments: config.maxComments || 1000 };
  }

  async scrape(url: string) {
    this.isRunning = true;
    try {
      this.emitProgress("initializing", 0, "Đang khởi tạo trình duyệt...");
      await this.launchBrowser();

      this.emitProgress("loading", 10, "Đang truy cập bài viết...");
      await this.navigateToUrl(url);

      // Chuyển sang "Tất cả bình luận"
      await this.switchToAllComments();

      this.emitProgress("scrolling", 20, "Đang tải bình luận...");
      await this.scrollAndLoadComments();

      this.emitProgress("extracting", 80, "Đang xử lý dữ liệu...");
      const results = await this.extractComments();

      this.emitProgress("saving", 100, `Hoàn thành! Tìm thấy ${results.length} bình luận.`);

      return {
        success: true,
        comments: results,
        totalComments: results.length,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("[FacebookScraper] Error:", msg);
      return {
        success: false,
        comments: Array.from(this.comments.values()),
        totalComments: this.comments.size,
        error: msg,
      };
    } finally {
      await this.cleanup();
    }
  }

  private async launchBrowser() {
    const proxyConfig = this.config.proxy ? this.parseProxy(this.config.proxy) : undefined;

    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-notifications"],
      proxy: proxyConfig,
    });

    this.context = await this.browser.newContext({
      userAgent:
        this.config.cookies.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "vi-VN",
    });

    if (this.config.cookies.data) {
      await this.setCookies(this.config.cookies.data);
    }

    this.page = await this.context.newPage();
  }

  private async navigateToUrl(url: string) {
    if (!this.page) return;

    // Facebook mobile trick: dùng mbasic hoặc mobile view đôi khi dễ hơn,
    // nhưng ở đây ta dùng Desktop view như logic Python để lấy full data
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Check Captcha (Logic từ Python port sang)
    const captcha = await this.page.$('div[class*="captcha"], #captcha-verify-container');
    if (captcha) {
      throw new Error("Phát hiện Captcha! Vui lòng cập nhật Cookie.");
    }

    // Đợi content load
    try {
      await this.page.waitForSelector('div[role="article"], div[role="main"]', { timeout: 15000 });
    } catch {
      console.warn("Main content not found, continuing...");
    }
  }

  /**
   * Logic chuyển filter "Phù hợp nhất" -> "Tất cả bình luận"
   * Port từ Python: _switch_to_all_comments
   */
  private async switchToAllComments() {
    if (!this.page) return;
    try {
      // Tìm nút Filter
      const filterBtn = this.page.locator('span:text-is("Phù hợp nhất"), span:text-is("Most relevant")').first();

      if (await filterBtn.isVisible()) {
        await filterBtn.click();
        await this.page.waitForTimeout(1000);

        const allCommentsOption = this.page
          .locator('span:text-is("Tất cả bình luận"), span:text-is("All comments")')
          .first();
        if (await allCommentsOption.isVisible()) {
          await allCommentsOption.click();
          console.log("[Facebook] Đã chuyển sang Tất cả bình luận");
          await this.page.waitForTimeout(2000);
        }
      }
    } catch (e) {
      console.log("[Facebook] Không chuyển được bộ lọc (có thể đã là All Comments)");
    }
  }

  /**
   * Logic Scroll phức tạp của Facebook
   * Port từ Python: _fb_scroll_burst, _find_fb_scroll_container
   */
  private async scrollAndLoadComments() {
    if (!this.page) return;

    let noNewDataCount = 0;
    let previousHeight = 0;
    const MAX_NO_DATA = 5;

    // Tìm nút "Xem thêm bình luận" và click loop
    // Trong Playwright ta có thể dùng locator để tìm và click thông minh hơn
    while (this.comments.size < (this.config.maxComments || 1000) && noNewDataCount < MAX_NO_DATA) {
      // 1. Click "Xem thêm" (View more comments)
      const viewMoreBtn = this.page
        .locator('span:text-is("Xem thêm bình luận"), span:text-is("View more comments")')
        .first();
      if (await viewMoreBtn.isVisible()) {
        try {
          await viewMoreBtn.click({ timeout: 1000 });
          await this.page.waitForTimeout(1000);
          noNewDataCount = 0; // Reset vì vừa click được
        } catch {}
      }

      // 2. Scroll Logic
      // Facebook comments thường nằm trong 1 div dialog (popup) hoặc body chính
      const dialog = this.page.locator('div[role="dialog"]').first();
      const isDialog = await dialog.isVisible();

      if (isDialog) {
        // Scroll dialog
        await dialog.evaluate((el) => (el.scrollTop = el.scrollHeight));
      } else {
        // Scroll window
        await this.page.mouse.wheel(0, 5000); // Scroll mạnh xuống dưới
        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      }

      await this.page.waitForTimeout(2000);

      // 3. Check progress
      // Đếm sơ bộ số lượng article hiện có trong DOM
      const count = await this.page.locator('div[role="article"]').count();

      if (count === previousHeight) {
        noNewDataCount++;
        // Thử scroll ngược lên tí rồi xuống lại (Trick từ Python logic)
        if (isDialog) {
          await dialog.evaluate((el) => (el.scrollTop = el.scrollTop - 500));
        } else {
          await this.page.mouse.wheel(0, -500);
        }
        await this.page.waitForTimeout(500);
      } else {
        noNewDataCount = 0;
        previousHeight = count;
      }

      // Update progress giả lập (vì chưa extract thật)
      const progress = Math.min(80, 20 + (count / (this.config.maxComments || 1000)) * 60);
      this.emitProgress("scrolling", progress, `Đã load khoảng ${count} comments...`);

      if (count >= (this.config.maxComments || 1000)) break;
    }
  }

  /**
   * Bóc tách dữ liệu
   * Port từ Python: scrape (phần cuối)
   */
  private async extractComments(): Promise<ScrapedComment[]> {
    if (!this.page) return [];

    // Chọn container
    let container = this.page.locator('div[role="dialog"]');
    if (!(await container.isVisible())) {
      container = this.page.locator("body"); // Fallback
    }

    // Lấy tất cả comment item (div[role="article"])
    const articles = await container.locator('div[role="article"]').all();
    const results: ScrapedComment[] = [];
    const seen = new Set<string>();

    for (const article of articles) {
      try {
        // Bỏ qua reply (comment con) nếu cần - Logic Python: _is_fb_reply_comment
        const ariaLabel = await article.getAttribute("aria-label");
        if (ariaLabel && (ariaLabel.includes("Reply") || ariaLabel.includes("Trả lời"))) {
          continue;
        }

        // Lấy nội dung text
        const text = await article.innerText();
        const lines = text.split("\n").filter((line) => !isJunkLine(line));

        // Logic Facebook: [Dòng 1: Tên] [Dòng 2+: Nội dung]
        let username = "Unknown";
        let content = "";

        if (lines.length >= 2) {
          username = lines[0]; // Tạm thời lấy text dòng 1 làm username (fallback)
          content = lines.slice(1).join("\n");
        } else if (lines.length === 1) {
          content = lines[0];
        }

        // Cố gắng lấy Username chuẩn từ Link (href)
        const linkEl = article.locator('a[href*="facebook.com"]').first();
        if (await linkEl.isVisible()) {
          const href = await linkEl.getAttribute("href");
          if (href) {
            const extractedId = extractFbUserId(href);
            if (extractedId !== "Unknown") {
              // Nếu extract được ID chuẩn thì dùng, không thì giữ nguyên tên hiển thị
              // Ở đây ta ưu tiên tên hiển thị cho đẹp, ID dùng để deduplicate
            }
          }
        }

        // Lấy Likes
        let likes = 0;
        // Logic tìm likes phức tạp của Python converted sang Playwright
        // Tìm element có aria-label chứa số
        // Tuy nhiên Playwright text search mạnh hơn
        const likeText = await article
          .locator('span:has-text("thích"), span:has-text("like")')
          .first()
          .textContent()
          .catch(() => "");
        if (likeText) {
          likes = parseCount(likeText || "0");
        }

        // Emoji (Playwright lấy text đã bao gồm emoji, nên không cần xử lý img[alt] phức tạp như Selenium trừ khi cần chính xác tuyệt đối)

        const uniqueKey = `${username}_${content.substring(0, 20)}`;
        if (!seen.has(uniqueKey) && content.trim().length > 0) {
          seen.add(uniqueKey);
          results.push({
            username,
            content,
            likes,
            timestamp: new Date().toISOString(), // Facebook ẩn timestamp kỹ, lấy time hiện tại
          });
        }
      } catch (e) {
        continue;
      }
    }

    return results;
  }

  private async setCookies(cookieData: string) {
    if (!this.context) return;
    try {
      const cookies = JSON.parse(cookieData);
      // Playwright cookie format slightly different form Selenium
      const pwCookies = cookies.map((c: any) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || ".facebook.com",
        path: c.path || "/",
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite || "Lax",
        expires: c.expires || c.expirationDate,
      }));
      await this.context.addCookies(pwCookies);
    } catch (e) {
      console.error("Cookie error", e);
    }
  }

  private parseProxy(proxyStr: string) {
    try {
      const url = new URL(proxyStr.startsWith("http") ? proxyStr : `http://${proxyStr}`);
      return {
        server: `${url.protocol}//${url.hostname}:${url.port}`,
        username: url.username,
        password: url.password,
      };
    } catch {
      return undefined;
    }
  }

  private emitProgress(phase: any, progress: number, message: string) {
    emitScrapeProgress(this.config.userId, {
      historyId: this.config.historyId,
      phase,
      progress: Math.round(progress),
      commentsFound: this.comments.size,
      message,
      timestamp: new Date(),
    });
  }

  private async cleanup() {
    await this.page?.close().catch(() => {});
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
  }
}
