// ===========================================
// TikTok Channel Scraper
// ===========================================
// Crawls video list from a TikTok channel using API interception

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { ChannelVideoData } from "../../repositories/channel.repository.js";
import { TikTokScraper } from "./tiktok.scraper.js";

// ===========================================
// Types
// ===========================================

interface TikTokVideoItem {
  id: string;
  desc?: string;
  createTime?: number;
  stats?: {
    playCount?: number;
    diggCount?: number;
    commentCount?: number;
    shareCount?: number;
  };
  video?: {
    cover?: { urlList?: string[] };
  };
}

interface TikTokVideoListResponse {
  itemList?: TikTokVideoItem[];
  hasMore?: boolean;
  cursor?: number | string;
}

export interface ChannelCrawlConfig {
  userId: string;
  crawlJobId: string;
  cookies: { data: string | null; userAgent: string | null };
  proxy: string | null;
  headless: boolean;
  minViews: number;
  maxVideos: number;
}

// ===========================================
// TikTok Channel Scraper Class
// ===========================================

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const CHANNEL_API_PATTERN = /\/api.*\/post\/item_list/;

export class TikTokChannelScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: ChannelCrawlConfig;
  private interceptedVideos = new Map<string, TikTokVideoItem>();
  private isRunning = false;

  constructor(config: ChannelCrawlConfig) {
    this.config = config;
  }

  async crawlChannel(channelUrl: string): Promise<ChannelVideoData[]> {
    this.isRunning = true;
    try {
      const username = this.extractUsername(channelUrl);
      console.log(`[ChannelScraper] 🚀 Crawling channel: ${username}`);

      await this.launchBrowser();

      if (this.config.cookies.data) {
        await this.applyCookies();
      }

      // Set up API interception before navigating
      this.setupApiInterception();

      await this.navigateToChannel(channelUrl);

      // Scroll to trigger pagination
      await this.scrollToLoadVideos();

      console.log(`[ChannelScraper] ✅ Intercepted ${this.interceptedVideos.size} videos`);

      return this.mapToChannelVideoData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[ChannelScraper] ❌ Error: ${msg}`);

      // Return whatever was intercepted
      if (this.interceptedVideos.size > 0) {
        return this.mapToChannelVideoData();
      }
      throw error;
    } finally {
      await this.cleanup();
      this.isRunning = false;
    }
  }

  private extractUsername(url: string): string {
    try {
      const match = url.match(/@([\w.-]+)/);
      return match ? `@${match[1]}` : url;
    } catch {
      return url;
    }
  }

  private async launchBrowser(): Promise<void> {
    const launchArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-notifications",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--shm-size=2g",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-hang-monitor",
      "--disable-ipc-flooding-protection",
      "--disable-popup-blocking",
      "--disable-prompt-on-repost",
      "--disable-renderer-backgrounding",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-first-run",
      "--safebrowsing-disable-auto-update",
      "--force-color-profile=srgb",
      "--disable-features=TranslateUI,VizDisplayCompositor",
      "--js-flags=--max-old-space-size=512",
      "--disable-software-rasterizer",
      "--window-size=500,1000",
      "--no-zygote",
      "--single-process",
    ];

    if (this.config.headless) {
      launchArgs.push("--headless=new");
    }

    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: false,
      args: launchArgs,
    };

    if (this.config.proxy) {
      const proxyConfig = this.parseProxyUrl(this.config.proxy);
      if (proxyConfig) {
        launchOptions.proxy = proxyConfig;
      }
    }

    this.browser = await chromium.launch(launchOptions);
    const userAgent = this.config.cookies.userAgent || DEFAULT_USER_AGENT;

    this.context = await this.browser.newContext({
      userAgent,
      viewport: null,
      locale: "vi-VN",
      timezoneId: "Asia/Ho_Chi_Minh",
    });

    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    this.page = await this.context.newPage();
    this.page.setDefaultNavigationTimeout(60_000);
    this.page.setDefaultTimeout(120_000);
  }

  private async applyCookies(): Promise<void> {
    if (!this.context || !this.page || !this.config.cookies.data) return;
    try {
      await this.page.goto("https://www.tiktok.com", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await this.page.waitForTimeout(500);

      const cookies = JSON.parse(this.config.cookies.data);
      const cookieList = Array.isArray(cookies) ? cookies : cookies.cookies || [];
      await this.context.clearCookies();

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
          sameSite: TikTokScraper.normalizeSameSite(c.sameSite),
        }));

      if (formattedCookies.length > 0) {
        try {
          await this.context.addCookies(formattedCookies);
          console.log(`[ChannelScraper] ✅ Applied ${formattedCookies.length} cookies`);
        } catch {
          for (const cookie of formattedCookies) {
            await this.context.addCookies([cookie]).catch(() => {});
          }
        }
      }
    } catch (error) {
      console.warn("[ChannelScraper] ⚠️ Could not apply cookies:", error);
    }
  }

  private setupApiInterception(): void {
    if (!this.page) return;

    this.page.on("response", async (response) => {
      const url = response.url();
      if (CHANNEL_API_PATTERN.test(url) && response.status() === 200) {
        try {
          const data = (await response.json()) as TikTokVideoListResponse;
          const items = data.itemList || [];
          for (const item of items) {
            if (item.id && !this.interceptedVideos.has(item.id)) {
              this.interceptedVideos.set(item.id, item);
            }
          }
          console.log(
            `[ChannelScraper] 📡 API response: ${items.length} items (total: ${this.interceptedVideos.size})`,
          );
        } catch {
          // ignore parse errors
        }
      }
    });
  }

  private async navigateToChannel(url: string): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await this.page.waitForTimeout(2000);
    const title = await this.page.title().catch(() => "");
    console.log(`[ChannelScraper] 📄 Page: ${title}`);
  }

  private async scrollToLoadVideos(): Promise<void> {
    if (!this.page) return;

    const maxVideos = this.config.maxVideos;
    let noNewData = 0;
    let scrollRound = 0;

    console.log("[ChannelScraper] 📜 Scrolling to load videos...");

    while (this.isRunning) {
      if (this.interceptedVideos.size >= maxVideos) {
        console.log(`[ChannelScraper] 🛑 Reached maxVideos limit: ${maxVideos}`);
        break;
      }

      const beforeCount = this.interceptedVideos.size;

      // Burst scroll: 15 times
      for (let i = 0; i < 15; i++) {
        await this.page.evaluate(() => window.scrollBy(0, 1200)).catch(() => {});
        await this.page.waitForTimeout(80);
      }
      await this.page.waitForTimeout(1000);

      scrollRound++;
      const afterCount = this.interceptedVideos.size;

      if (afterCount > beforeCount) {
        noNewData = 0;
        console.log(`[ChannelScraper] Round ${scrollRound}: +${afterCount - beforeCount} (total: ${afterCount})`);
      } else {
        noNewData++;
        console.log(`[ChannelScraper] Round ${scrollRound}: no new data (${noNewData}/3)`);

        if (noNewData < 3) {
          // Scroll up then down to trigger load
          await this.page.evaluate(() => window.scrollBy(0, -800)).catch(() => {});
          await this.page.waitForTimeout(400);
          await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
          await this.page.waitForTimeout(600);
        }
      }

      if (noNewData >= 3) {
        console.log("[ChannelScraper] 🛑 No more videos to load");
        break;
      }
    }
  }

  private mapToChannelVideoData(): ChannelVideoData[] {
    const { minViews } = this.config;
    const result: ChannelVideoData[] = [];

    for (const [id, item] of this.interceptedVideos) {
      const views = item.stats?.playCount ?? 0;
      result.push({
        tiktokId: id,
        videoUrl: `https://www.tiktok.com/@user/video/${id}`,
        description: item.desc,
        thumbnailUrl: item.video?.cover?.urlList?.[0],
        views,
        likes: item.stats?.diggCount ?? 0,
        commentCount: item.stats?.commentCount ?? 0,
        shares: item.stats?.shareCount ?? 0,
        postDate: item.createTime ? new Date(item.createTime * 1000) : undefined,
        meetsFilter: views >= minViews,
      });
    }

    // Sort by views descending
    result.sort((a, b) => b.views - a.views);

    // Limit to maxVideos
    return result.slice(0, this.config.maxVideos);
  }

  private parseProxyUrl(proxy: string): { server: string; username?: string; password?: string } | null {
    try {
      let proxyUrl = proxy.trim();
      if (!proxyUrl.startsWith("http://") && !proxyUrl.startsWith("https://") && !proxyUrl.startsWith("socks5://")) {
        proxyUrl = `http://${proxyUrl}`;
      }
      const url = new URL(proxyUrl);
      return {
        server: `${url.protocol}//${url.host}`,
        username: url.username || undefined,
        password: url.password || undefined,
      };
    } catch {
      return null;
    }
  }

  private async cleanup(): Promise<void> {
    if (this.page) { await this.page.close().catch(() => {}); this.page = null; }
    if (this.context) { await this.context.close().catch(() => {}); this.context = null; }
    if (this.browser) { await this.browser.close().catch(() => {}); this.browser = null; }
  }
}
