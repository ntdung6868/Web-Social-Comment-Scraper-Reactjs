// ===========================================
// Captcha Detector — DOM detection + classification
// ===========================================

import type { ElementHandle, Page } from "playwright";
import { CaptchaType, type CaptchaDetectionResult } from "./types.js";

// Platform-specific presence selectors
const PLATFORM_SELECTORS: Record<string, string[]> = {
  tiktok: [
    "#captcha-verify-container-main-page",
    ".captcha-verify-container",
    ".secsdk-captcha-drag-wrapper",
    '[class*="captcha"]',
    '[id*="captcha"]',
    'div[data-testid="captcha"]',
  ],
  facebook: [
    '[class*="captcha"]',
    '[class*="Captcha"]',
    '[id*="captcha"]',
  ],
};

export class CaptchaDetector {
  private platform: "tiktok" | "facebook";

  constructor(platform: "tiktok" | "facebook") {
    this.platform = platform;
  }

  /**
   * Detect captcha presence and classify its type.
   */
  async detect(page: Page): Promise<CaptchaDetectionResult> {
    const selectors = PLATFORM_SELECTORS[this.platform] ?? PLATFORM_SELECTORS.tiktok!;

    // Find the first visible captcha container
    let containerElement: ElementHandle | null = null;

    for (const selector of selectors) {
      try {
        const el = await page.$(selector);
        if (el && (await el.isVisible().catch(() => false))) {
          containerElement = el;
          break;
        }
      } catch {
        // continue
      }
    }

    if (!containerElement) {
      return { detected: false, type: CaptchaType.UNKNOWN, containerElement: null };
    }

    // Classify the captcha type using structural heuristics
    const type = await this.classify(page, containerElement);

    return { detected: true, type, containerElement };
  }

  /**
   * Quick check: is any captcha currently visible?
   */
  async isPresent(page: Page): Promise<boolean> {
    const selectors = PLATFORM_SELECTORS[this.platform] ?? PLATFORM_SELECTORS.tiktok!;

    for (const selector of selectors) {
      try {
        const el = await page.$(selector);
        if (el && (await el.isVisible().catch(() => false))) {
          return true;
        }
      } catch {
        // continue
      }
    }
    return false;
  }

  /**
   * Classify captcha type using structural heuristics inside the container.
   *
   * 1. Slider/drag indicators → SLIDER_PUZZLE
   * 2. Multiple small images (50-150px) >= 5 → OBJECT_MATCH_3D
   * 3. Otherwise → UNKNOWN
   */
  private async classify(_page: Page, container: ElementHandle): Promise<CaptchaType> {
    try {
      const classification = await container.evaluate((node) => {
        const el = node as HTMLElement;

        // Check for slider/drag indicators
        const sliderIndicators = [
          el.querySelector('[class*="drag"]'),
          el.querySelector('[class*="slider"]'),
          el.querySelector('[class*="Drag"]'),
          el.querySelector('[class*="Slider"]'),
          el.querySelector('.secsdk-captcha-drag-icon'),
          el.querySelector('[class*="slide"]'),
        ];
        const hasSlider = sliderIndicators.some((indicator) => indicator !== null);

        // Analyse images inside the container
        const imgs = el.querySelectorAll("img");
        let smallImageCount = 0;
        let largeSquareCount = 0;
        let totalImgCount = 0;

        for (const img of imgs) {
          const rect = img.getBoundingClientRect();
          if (rect.width < 5 || rect.height < 5) continue; // skip invisible
          totalImgCount++;

          if (rect.width >= 50 && rect.width <= 150 && rect.height >= 50 && rect.height <= 150) {
            smallImageCount++;
          }

          // Large roughly-square image (rotate captcha image is ~340x340)
          const ratio = rect.width / (rect.height || 1);
          if (rect.width >= 150 && ratio > 0.8 && ratio < 1.25) {
            largeSquareCount++;
          }
        }

        // --- Classification priority ---

        // 1. Explicit rotate indicators
        const rotateIndicators = [
          el.querySelector('[class*="rotate"]'),
          el.querySelector('[class*="Rotate"]'),
          el.querySelector('[class*="whirl"]'),
        ];
        if (rotateIndicators.some((ind) => ind !== null)) return "ROTATE_PUZZLE";

        // 2. Slider + single large square image + no separate small piece
        //    → rotate puzzle (slider puzzle has bg image + separate small piece)
        if (hasSlider && largeSquareCount >= 1 && totalImgCount <= 2) {
          return "ROTATE_PUZZLE";
        }

        // 3. Standard slider puzzle (has slider + multiple images)
        if (hasSlider) return "SLIDER_PUZZLE";

        // 4. Object match grid (>= 5 small images)
        if (smallImageCount >= 5) return "OBJECT_MATCH_3D";

        return "UNKNOWN";
      });

      return classification as CaptchaType;
    } catch {
      return CaptchaType.UNKNOWN;
    }
  }
}
