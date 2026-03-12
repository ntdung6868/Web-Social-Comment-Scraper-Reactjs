// ===========================================
// Captcha Solver — Orchestrator
// ===========================================
// detect → route to strategy → retry → verify

import type { Page } from "playwright";
import { CaptchaType, type CaptchaSolveResult, type CaptchaSolverOptions, type CaptchaStrategy } from "./types.js";
import { CaptchaDetector } from "./captcha-detector.js";
import { SliderStrategy } from "./strategies/slider.strategy.js";
import { RotatePuzzleStrategy } from "./strategies/rotate-puzzle.strategy.js";
import { ObjectMatchStrategy } from "./strategies/object-match.strategy.js";
import { ManualWaitStrategy } from "./strategies/manual-wait.strategy.js";

export class CaptchaSolver {
  private detector: CaptchaDetector;
  private strategies: Map<CaptchaType, CaptchaStrategy>;
  private logPrefix: string;

  constructor(options: CaptchaSolverOptions) {
    this.detector = new CaptchaDetector(options.platform);
    this.logPrefix = options.logPrefix ?? `[Captcha:${options.platform}]`;

    // Register strategies
    this.strategies = new Map();
    this.strategies.set(CaptchaType.SLIDER_PUZZLE, new SliderStrategy());
    this.strategies.set(CaptchaType.ROTATE_PUZZLE, new RotatePuzzleStrategy());
    this.strategies.set(CaptchaType.OBJECT_MATCH_3D, new ObjectMatchStrategy());
    this.strategies.set(CaptchaType.UNKNOWN, new ManualWaitStrategy(options.headless, options.platform));
  }

  /**
   * Detect captcha on the page and attempt to solve it.
   * Returns immediately if no captcha is present.
   */
  async solveIfPresent(page: Page): Promise<CaptchaSolveResult> {
    // 1. Detect
    const detection = await this.detector.detect(page);

    if (!detection.detected || !detection.containerElement) {
      return { solved: true, attempts: 0, type: CaptchaType.UNKNOWN };
    }

    console.log(`${this.logPrefix} ⚠️ CAPTCHA DETECTED — type: ${detection.type}`);

    // 2. Look up strategy (fallback to UNKNOWN/manual)
    const strategy = this.strategies.get(detection.type) ?? this.strategies.get(CaptchaType.UNKNOWN)!;

    // 3. Retry loop
    for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
      try {
        console.log(`${this.logPrefix} 🔄 Solve attempt ${attempt}/${strategy.maxAttempts} (${detection.type})`);

        // Re-detect to get fresh container (captcha might reload with new image)
        const freshDetection = attempt > 1 ? await this.detector.detect(page) : detection;

        if (!freshDetection.detected || !freshDetection.containerElement) {
          // Captcha disappeared between retries
          console.log(`${this.logPrefix} ✅ Captcha gone before attempt ${attempt}!`);
          return { solved: true, attempts: attempt - 1, type: detection.type };
        }

        await strategy.solve(page, freshDetection.containerElement);

        // Wait for page to settle after solve attempt
        await page.waitForTimeout(2500 + Math.floor(Math.random() * 1000));

        // Verify: captcha gone?
        if (!(await this.detector.isPresent(page))) {
          console.log(`${this.logPrefix} ✅ Captcha solved successfully on attempt ${attempt}!`);
          return { solved: true, attempts: attempt, type: detection.type };
        }

        console.log(`${this.logPrefix} ⚠️ Captcha still present after attempt ${attempt}`);

        // Wait before retrying
        if (attempt < strategy.maxAttempts) {
          await page.waitForTimeout(1500 + Math.floor(Math.random() * 1500));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${this.logPrefix} ❌ Attempt ${attempt} error: ${msg}`);

        if (attempt < strategy.maxAttempts) {
          await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));
        }
      }
    }

    // All attempts exhausted
    console.error(`${this.logPrefix} 🛑 Could not solve captcha after ${strategy.maxAttempts} attempts.`);
    return {
      solved: false,
      attempts: strategy.maxAttempts,
      type: detection.type,
      error: "captcha_detected_msg",
    };
  }
}
