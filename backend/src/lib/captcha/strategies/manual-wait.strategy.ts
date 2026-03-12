// ===========================================
// Manual Wait Strategy — Fallback for unknown captcha types
// ===========================================

import type { ElementHandle, Page } from "playwright";
import { CaptchaType, type CaptchaStrategy } from "../types.js";
import { CaptchaDetector } from "../captcha-detector.js";

export class ManualWaitStrategy implements CaptchaStrategy {
  readonly type = CaptchaType.UNKNOWN;
  readonly maxAttempts = 1;

  private headless: boolean;
  private platform: "tiktok" | "facebook";

  constructor(headless: boolean, platform: "tiktok" | "facebook") {
    this.headless = headless;
    this.platform = platform;
  }

  async solve(page: Page, _container: ElementHandle): Promise<boolean> {
    // In headless mode, cannot wait for human
    if (this.headless) {
      console.warn("[Captcha:Manual] ❌ Headless mode — cannot wait for human to solve.");
      return false;
    }

    console.log("[Captcha:Manual] ⏳ Waiting for human to solve captcha...");

    const detector = new CaptchaDetector(this.platform);
    const maxWait = 120_000; // 120 seconds
    const pollInterval = 3_000;
    let waited = 0;

    while (waited < maxWait) {
      if (!(await detector.isPresent(page))) {
        console.log("[Captcha:Manual] ✅ Captcha solved by human!");
        await page.waitForTimeout(2000); // Wait for page to settle
        return true;
      }

      await page.waitForTimeout(pollInterval);
      waited += pollInterval;

      if (waited % 15000 === 0) {
        console.log(`[Captcha:Manual] ⏳ Still waiting for captcha (${waited / 1000}s)...`);
      }
    }

    console.warn("[Captcha:Manual] ❌ Captcha not solved within 120s.");
    return false;
  }
}
