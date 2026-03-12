// ===========================================
// Stealth Browser Launcher
// ===========================================
// Shared browser initialization with anti-bot evasion for all scrapers.
// Uses playwright-extra + stealth plugin + comprehensive fingerprint masking.

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, BrowserContext, Page } from "playwright";

// Register stealth plugin once at module level.
// Hides: navigator.webdriver, chrome.runtime, iframe contentWindow,
// WebGL vendor/renderer, languages, permissions, codec ordering, etc.
chromium.use(StealthPlugin());

// ===========================================
// User-Agent pool — realistic Chrome on desktop
// ===========================================
// Rotated per-launch so repeated scrapes don't share a single fingerprint.
// All UAs must match the platform string below (macOS or Windows).

interface UAProfile {
  userAgent: string;
  platform: string;
  devicePixelRatio: number;
}

const UA_PROFILES: UAProfile[] = [
  // Chrome 124 on macOS Sonoma
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    platform: "MacIntel",
    devicePixelRatio: 2,
  },
  // Chrome 123 on macOS Ventura
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    platform: "MacIntel",
    devicePixelRatio: 2,
  },
  // Chrome 124 on Windows 11
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    platform: "Win32",
    devicePixelRatio: 1,
  },
  // Chrome 123 on Windows 10
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    platform: "Win32",
    devicePixelRatio: 1,
  },
  // Chrome 125 on macOS
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    platform: "MacIntel",
    devicePixelRatio: 2,
  },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ===========================================
// Types
// ===========================================

export interface StealthLaunchOptions {
  headless: boolean;
  proxy?: string | null;
  /** Override UA (e.g. from user-provided cookies). Disables profile rotation. */
  userAgentOverride?: string | null;
  /** Window dimensions. Default: 500x1000 (mobile-like for TikTok). */
  windowWidth?: number;
  windowHeight?: number;
}

export interface StealthBrowserResult {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

// ===========================================
// Launch
// ===========================================

export async function launchStealthBrowser(options: StealthLaunchOptions): Promise<StealthBrowserResult> {
  const profile = pickRandom(UA_PROFILES);
  const userAgent = options.userAgentOverride || profile.userAgent;
  const windowWidth = options.windowWidth ?? 500;
  const windowHeight = options.windowHeight ?? 1000;

  // ── Chrome flags ──
  const launchArgs = [
    // Sandbox / stability
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-notifications",
    "--disable-infobars",
    "--shm-size=2g",

    // Anti-detection
    "--disable-blink-features=AutomationControlled",

    // Stability
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
    `--window-size=${windowWidth},${windowHeight}`,

    // VPS RAM optimizations
    "--no-zygote",
    "--single-process",
  ];

  // Use full Chromium with --headless=new (not the headless shell which is fingerprinted)
  if (options.headless) {
    launchArgs.push("--headless=new");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const launchOptions: any = {
    headless: false, // we handle headless via --headless=new flag
    args: launchArgs,
  };

  // Proxy
  if (options.proxy) {
    const proxyConfig = parseProxyUrl(options.proxy);
    if (proxyConfig) {
      launchOptions.proxy = proxyConfig;
    }
  }

  const browser = await chromium.launch(launchOptions);

  // ── Context with fingerprint masking ──
  const context = await browser.newContext({
    userAgent,
    viewport: null,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    // Grant permissions a real user would have
    permissions: ["geolocation"],
    // Note: deviceScaleFactor is incompatible with viewport:null,
    // so we set it via addInitScript instead.
  });

  // ── Comprehensive init scripts ──
  // These run before any page JS — they patch fingerprint leaks
  // that the stealth plugin might miss.
  await context.addInitScript(
    ({ platform, languages, dpr }) => {
      // 1. navigator.webdriver (belt-and-suspenders with stealth plugin)
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });

      // 2. navigator.platform — must match the UA string
      Object.defineProperty(navigator, "platform", { get: () => platform });

      // 3. navigator.languages — Vietnamese user profile
      Object.defineProperty(navigator, "languages", {
        get: () => languages,
      });

      // 4. devicePixelRatio — must be consistent with UA
      Object.defineProperty(window, "devicePixelRatio", { get: () => dpr });

      // 5. Notification permission — avoid "denied" (bot signal)
      if (typeof Notification !== "undefined") {
        Object.defineProperty(Notification, "permission", { get: () => "default" });
      }

      // 6. navigator.plugins — non-empty (headless has 0 plugins = bot signal)
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5], // length > 0 is what matters
      });

      // 7. navigator.hardwareConcurrency — realistic core count
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });

      // 8. navigator.deviceMemory — realistic RAM
      if ("deviceMemory" in navigator) {
        Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
      }

      // 9. connection.rtt — realistic network latency (not 0 like bots)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conn = (navigator as any).connection;
        if (conn) {
          Object.defineProperty(conn, "rtt", { get: () => 50 });
        }
      } catch {
        // ignore
      }

      // 10. WebGL renderer — appear as real GPU, not "SwiftShader" (headless)
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (param: number) {
        // UNMASKED_VENDOR_WEBGL
        if (param === 0x9245) return "Google Inc. (Intel)";
        // UNMASKED_RENDERER_WEBGL
        if (param === 0x9246) return "ANGLE (Intel, Intel(R) UHD Graphics, OpenGL 4.1)";
        return getParameter.call(this, param);
      };
    },
    {
      platform: options.userAgentOverride ? profile.platform : profile.platform,
      languages: ["vi-VN", "vi", "en-US", "en"],
      dpr: profile.devicePixelRatio,
    },
  );

  const page = await context.newPage();

  // Timeouts
  page.setDefaultNavigationTimeout(60_000);
  page.setDefaultTimeout(240_000);

  // Resize window via CDP (set actual window bounds, not just content viewport)
  try {
    const cdp = await page.context().newCDPSession(page);
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    await cdp.send("Browser.setWindowBounds", {
      windowId,
      bounds: { left: 0, top: 0, width: windowWidth, height: windowHeight, windowState: "normal" },
    });
  } catch {
    // CDP resize may fail in headless — --window-size arg is the fallback
  }

  console.log(`[Stealth] Browser launched (UA: ...${userAgent.slice(-30)}, platform: ${profile.platform})`);

  return { browser, context, page };
}

// ===========================================
// Human-like micro-behaviors
// ===========================================

/**
 * Random "thinking time" pause — mimics a human reading before acting.
 * Call before screenshots, clicks, or captcha interactions.
 */
export async function thinkingPause(page: Page, minMs = 500, maxMs = 1500): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await page.waitForTimeout(ms);
}

/**
 * Subtle scroll jitter — scroll up/down a bit to mimic a user
 * reading the page before scraping content.
 */
export async function humanScrollJitter(page: Page): Promise<void> {
  // Scroll up slightly
  const upAmount = 50 + Math.floor(Math.random() * 150);
  await page.evaluate((dy) => window.scrollBy(0, -dy), upAmount);
  await thinkingPause(page, 300, 800);

  // Scroll back down
  await page.evaluate((dy) => window.scrollBy(0, dy + Math.floor(Math.random() * 50)), upAmount);
  await thinkingPause(page, 200, 500);
}

// ===========================================
// Proxy parser (shared)
// ===========================================

function parseProxyUrl(proxy: string): { server: string; username?: string; password?: string } | null {
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
    return null;
  }
}
