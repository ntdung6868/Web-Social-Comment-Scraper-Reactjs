// ===========================================
// Captcha Solver — Detection gate
// ===========================================
// Detect only. Scrapers must stop and let the UI guide the user.

import type { Page } from "playwright";
import { CaptchaType, type CaptchaSolveResult, type CaptchaSolverOptions } from "./types.js";
import { CaptchaDetector } from "./captcha-detector.js";

export class CaptchaSolver {
  private detector: CaptchaDetector;
  private logPrefix: string;

  constructor(options: CaptchaSolverOptions) {
    this.detector = new CaptchaDetector(options.platform);
    this.logPrefix = options.logPrefix ?? `[Captcha:${options.platform}]`;
  }

  /**
   * Detect captcha on the page.
   * Returns solved=true only when no captcha is present.
   * When captcha is visible, return a stable error key so the frontend can
   * show the guide CTA instead of trying to solve it in the scraper.
   *
   * Kept as solveIfPresent() to preserve the scraper call sites.
   * Returns immediately if no captcha is present.
   */
  async solveIfPresent(page: Page): Promise<CaptchaSolveResult> {
    const detection = await this.detector.detect(page);

    if (!detection.detected || !detection.containerElement) {
      return { solved: true, attempts: 0, type: CaptchaType.UNKNOWN };
    }

    console.warn(`${this.logPrefix} ⚠️ CAPTCHA DETECTED — type: ${detection.type}. Stopping scrape.`);
    return {
      solved: false,
      attempts: 0,
      type: detection.type,
      error: "captcha_detected_msg",
    };
  }
}
