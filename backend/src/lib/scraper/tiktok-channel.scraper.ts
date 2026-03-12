// ===========================================
// TikTok Channel Scraper
// ===========================================
// Crawls video list from a TikTok channel using API interception

import type { Browser, BrowserContext, Page } from "playwright";
import type { ChannelVideoData } from "../../repositories/channel.repository.js";
import { TikTokScraper } from "./tiktok.scraper.js";
import { CaptchaSolver } from "../captcha/index.js";
import { launchStealthBrowser } from "./stealth-browser.js";

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

// Used only by HTTP API fallback (non-browser path)
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CHANNEL_API_PATTERN = /\/api.*\/post\/item_list/;

export class TikTokChannelScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: ChannelCrawlConfig;
  private interceptedVideos = new Map<string, TikTokVideoItem>();
  private isRunning = false;
  private captchaSolver: CaptchaSolver;

  constructor(config: ChannelCrawlConfig) {
    this.config = config;
    this.captchaSolver = new CaptchaSolver({
      platform: "tiktok",
      headless: config.headless,
      logPrefix: "[ChannelScraper]",
    });
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

      // Fallback: if Playwright got 0 videos (e.g. datacenter IP blocked by TikTok),
      // try direct HTTP API calls instead
      if (this.interceptedVideos.size === 0) {
        console.log("[ChannelScraper] ⚠️ 0 videos via browser — trying HTTP API fallback...");
        try {
          const fallbackVideos = await this.crawlChannelViaApi(username);
          if (fallbackVideos.length > 0) {
            console.log(`[ChannelScraper] ✅ HTTP fallback got ${fallbackVideos.length} videos`);
            return fallbackVideos;
          }
        } catch (e) {
          console.error("[ChannelScraper] ❌ HTTP fallback failed:", e instanceof Error ? e.message : e);
        }
      }

      return this.mapToChannelVideoData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[ChannelScraper] ❌ Error: ${msg}`);

      if (this.interceptedVideos.size > 0) {
        return this.mapToChannelVideoData();
      }

      // Captcha on browser (datacenter IP) — try HTTP fallback before giving up
      if (msg === "captcha_detected_msg") {
        console.log("[ChannelScraper] ⚠️ Captcha on browser — trying HTTP API fallback...");
        try {
          const username = this.extractUsername(channelUrl);
          const fallbackVideos = await this.crawlChannelViaApi(username);
          if (fallbackVideos.length > 0) {
            console.log(`[ChannelScraper] ✅ HTTP fallback got ${fallbackVideos.length} videos despite captcha`);
            return fallbackVideos;
          }
        } catch (e) {
          console.error("[ChannelScraper] ❌ HTTP fallback also failed:", e instanceof Error ? e.message : e);
        }
        // Both browser captcha + HTTP fallback failed → re-throw captcha error so frontend shows captcha toast

      }

      throw error;
    } finally {
      await this.cleanup();
      this.isRunning = false;
    }
  }

  // ===========================================
  // HTTP API Fallback (for datacenter IPs)
  // ===========================================

  private buildCookieHeader(): string {
    if (!this.config.cookies.data) return "";
    try {
      const parsed = JSON.parse(this.config.cookies.data);
      const list: Array<{ name: string; value: string }> = Array.isArray(parsed) ? parsed : parsed.cookies || [];
      return list.map((c) => `${c.name}=${c.value}`).join("; ");
    } catch {
      return "";
    }
  }

  private buildFetchHeaders(referer?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": this.config.cookies.userAgent || DEFAULT_USER_AGENT,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      "Referer": referer || "https://www.tiktok.com/",
      "Origin": "https://www.tiktok.com",
    };
    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) headers["Cookie"] = cookieHeader;
    return headers;
  }

  private extractVideosFromHtml(html: string): TikTokVideoItem[] {
    // Try __NEXT_DATA__ (older TikTok web)
    try {
      const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (m?.[1]) {
        const json = JSON.parse(m[1]);
        const items: TikTokVideoItem[] =
          json?.props?.pageProps?.itemList ??
          json?.props?.pageProps?.items ??
          [];
        if (items.length > 0) {
          console.log(`[ChannelScraper] 📦 Found ${items.length} videos in __NEXT_DATA__`);
          return items;
        }
      }
    } catch {}

    // Try SIGI_STATE (newer TikTok web)
    try {
      const m = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
      if (m?.[1]) {
        const json = JSON.parse(m[1]);
        // ItemModule is a map of videoId → videoItem
        const itemModule = json?.ItemModule as Record<string, TikTokVideoItem> | undefined;
        if (itemModule) {
          const items = Object.values(itemModule);
          if (items.length > 0) {
            console.log(`[ChannelScraper] 📦 Found ${items.length} videos in SIGI_STATE`);
            return items;
          }
        }
      }
    } catch {}

    // Try __UNIVERSAL_DATA__ (newest TikTok web)
    try {
      const m = html.match(/<script id="__UNIVERSAL_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (m?.[1]) {
        const json = JSON.parse(m[1]);
        // Path varies; search recursively for itemList array
        const items = this.findItemListInJson(json);
        if (items.length > 0) {
          console.log(`[ChannelScraper] 📦 Found ${items.length} videos in __UNIVERSAL_DATA__`);
          return items;
        }
      }
    } catch {}

    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private findItemListInJson(obj: any, depth = 0): TikTokVideoItem[] {
    if (depth > 8 || !obj || typeof obj !== "object") return [];
    if (Array.isArray(obj) && obj.length > 0 && obj[0]?.id && obj[0]?.stats) return obj as TikTokVideoItem[];
    for (const key of Object.keys(obj)) {
      const result = this.findItemListInJson(obj[key], depth + 1);
      if (result.length > 0) return result;
    }
    return [];
  }

  private async getSecUidAndInitialVideos(handle: string): Promise<{ secUid: string | null; initialVideos: TikTokVideoItem[] }> {
    // Method 1: user/detail API (fast, but blocked on datacenter IPs)
    try {
      const url = `https://www.tiktok.com/api/user/detail/?uniqueId=${encodeURIComponent(handle)}&aid=1988&device_platform=web_pc&region=VN&language=vi-VN`;
      const resp = await fetch(url, {
        headers: this.buildFetchHeaders(`https://www.tiktok.com/@${handle}`),
        signal: AbortSignal.timeout(12000),
      });
      if (resp.ok) {
        const text = await resp.text();
        if (text.trim()) {
          const data = JSON.parse(text) as { userInfo?: { user?: { secUid?: string } } };
          const secUid = data?.userInfo?.user?.secUid ?? null;
          if (secUid) {
            console.log(`[ChannelScraper] ✅ secUid from API: ${secUid.slice(0, 20)}...`);
            return { secUid, initialVideos: [] };
          }
        }
      }
    } catch (e) {
      console.warn(`[ChannelScraper] ⚠️ [Method1] ${e instanceof Error ? e.message : e}`);
    }

    // Method 2: channel HTML page — works from datacenter IPs (SEO)
    try {
      const pageUrl = `https://www.tiktok.com/@${handle}`;
      console.log(`[ChannelScraper] 🔍 Fetching channel HTML...`);
      const resp = await fetch(pageUrl, {
        headers: { ...this.buildFetchHeaders(), Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        signal: AbortSignal.timeout(20000),
      });
      if (resp.ok) {
        const html = await resp.text();
        const m = html.match(/"secUid"\s*:\s*"([^"]{20,})"/);
        const secUid = m?.[1] ?? null;
        const initialVideos = secUid ? this.extractVideosFromHtml(html) : [];
        if (secUid) {
          console.log(`[ChannelScraper] ✅ secUid from HTML: ${secUid.slice(0, 20)}... | initial videos: ${initialVideos.length}`);
          return { secUid, initialVideos };
        }
        console.warn(`[ChannelScraper] ⚠️ secUid not found in HTML (${html.length} bytes)`);
      }
    } catch (e) {
      console.warn(`[ChannelScraper] ⚠️ [Method2] ${e instanceof Error ? e.message : e}`);
    }

    return { secUid: null, initialVideos: [] };
  }

  private async crawlChannelViaApi(username: string): Promise<ChannelVideoData[]> {
    const handle = username.startsWith("@") ? username.slice(1) : username;
    const channelReferer = `https://www.tiktok.com/@${handle}`;

    const { secUid, initialVideos } = await this.getSecUidAndInitialVideos(handle);
    if (!secUid) throw new Error("Could not resolve secUid for " + username);

    // Start with videos already found in HTML
    const videos = new Map<string, TikTokVideoItem>();
    for (const item of initialVideos) {
      if (item.id) videos.set(item.id, item);
    }
    console.log(`[ChannelScraper] 📦 HTML seed: ${videos.size} videos`);

    // Try paginated API for more (may be blocked on datacenter IPs)
    let cursor = videos.size;
    let hasMore = true;
    let page = 0;
    let apiFailures = 0;

    while (hasMore && videos.size < this.config.maxVideos && apiFailures < 2) {
      page++;
      const apiUrl = new URL("https://www.tiktok.com/api/post/item_list/");
      apiUrl.searchParams.set("aid", "1988");
      apiUrl.searchParams.set("count", "35");
      apiUrl.searchParams.set("secUid", secUid);
      apiUrl.searchParams.set("cursor", String(cursor));
      apiUrl.searchParams.set("device_platform", "web_pc");
      apiUrl.searchParams.set("region", "VN");
      apiUrl.searchParams.set("language", "vi-VN");
      apiUrl.searchParams.set("from_page", "user");

      const resp = await fetch(apiUrl.toString(), {
        headers: this.buildFetchHeaders(channelReferer),
      });

      if (!resp.ok) {
        console.warn(`[ChannelScraper] ⚠️ item_list page ${page} status: ${resp.status}`);
        break;
      }

      const text = await resp.text();
      if (!text.trim()) {
        console.warn(`[ChannelScraper] ⚠️ item_list page ${page}: empty body (IP blocked)`);
        apiFailures++;
        break;
      }

      let data: TikTokVideoListResponse;
      try {
        data = JSON.parse(text) as TikTokVideoListResponse;
      } catch {
        console.warn(`[ChannelScraper] ⚠️ item_list page ${page}: JSON parse failed`);
        apiFailures++;
        break;
      }

      const items = data.itemList ?? [];
      for (const item of items) {
        if (item.id) videos.set(item.id, item);
      }
      console.log(`[ChannelScraper] 📡 HTTP page ${page}: ${items.length} items (total: ${videos.size})`);

      hasMore = data.hasMore ?? false;
      cursor = typeof data.cursor === "number" ? data.cursor : parseInt(String(data.cursor ?? 0), 10);

      if (items.length === 0) break;

      // Small delay between pages
      await new Promise((r) => setTimeout(r, 500));
    }

    // Temporarily swap interceptedVideos for mapToChannelVideoData reuse
    const prev = this.interceptedVideos;
    this.interceptedVideos = videos;
    const result = this.mapToChannelVideoData();
    this.interceptedVideos = prev;
    return result;
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
    const { browser, context, page } = await launchStealthBrowser({
      headless: this.config.headless,
      proxy: this.config.proxy,
      userAgentOverride: this.config.cookies.userAgent,
    });

    this.browser = browser;
    this.context = context;
    this.page = page;
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

  private async solveCaptchaOrThrow(): Promise<void> {
    if (!this.page) return;
    const result = await this.captchaSolver.solveIfPresent(this.page);
    if (!result.solved) {
      throw new Error("captcha_detected_msg");
    }
  }

  private async navigateToChannel(url: string): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await this.page.waitForTimeout(2000);
    const title = await this.page.title().catch(() => "");
    console.log(`[ChannelScraper] 📄 Page: ${title}`);
    await this.solveCaptchaOrThrow();
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
      await this.solveCaptchaOrThrow();

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

  private async cleanup(): Promise<void> {
    if (this.page) { await this.page.close().catch(() => {}); this.page = null; }
    if (this.context) { await this.context.close().catch(() => {}); this.context = null; }
    if (this.browser) { await this.browser.close().catch(() => {}); this.browser = null; }
  }
}
