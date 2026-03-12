// ===========================================
// Slider Puzzle Strategy — Jimp edge detection solver
// ===========================================

import type { ElementHandle, Page } from "playwright";
import { Jimp } from "jimp";
import { CaptchaType, type CaptchaStrategy } from "../types.js";
import { simulateHumanDrag } from "../human-interaction.js";

// Known selectors for slider handle (tried first before heuristic fallback)
const SLIDER_HANDLE_SELECTORS = [
  ".secsdk-captcha-drag-icon",
  ".sc-slider-btn",
  '[class*="captcha"] [class*="drag"]',
  '[class*="slider"] button',
  ".captcha-slider-btn",
];

// Known selectors for background image (tried first before heuristic fallback)
const CAPTCHA_BG_SELECTORS = [
  "#captcha-verify-image",
  ".captcha_verify_img_slide",
  '[class*="captcha"] img[src*="captcha"]',
  ".verify-image img",
  'img[class*="captcha"]',
];

export class SliderStrategy implements CaptchaStrategy {
  readonly type = CaptchaType.SLIDER_PUZZLE;
  readonly maxAttempts = 3;

  async solve(page: Page, container: ElementHandle): Promise<boolean> {
    // 1. Find the slider handle
    const sliderHandle = await this.findSliderHandle(page, container);
    if (!sliderHandle) {
      console.warn("[Captcha:Slider] ❌ Slider handle not found.");
      return false;
    }

    // 2. Find the background puzzle image
    const bgElement = await this.findBgImage(page, container);
    if (!bgElement) {
      console.warn("[Captcha:Slider] ❌ Background image not found.");
      return false;
    }

    // 3. Screenshot the background and calculate the gap distance
    const bgBuffer = await bgElement.screenshot();
    const distanceX = await this.calculatePuzzleDistance(bgBuffer);

    if (distanceX <= 0) {
      console.warn("[Captcha:Slider] ❌ Could not detect puzzle gap distance.");
      return false;
    }

    console.log(`[Captcha:Slider] 📐 Detected gap at X=${distanceX}px`);

    // 4. Drag the slider
    await simulateHumanDrag(page, sliderHandle, distanceX);

    return true;
  }

  /**
   * Find slider handle: try known selectors first, fallback to heuristic
   * (find the draggable/interactive element inside the container).
   */
  private async findSliderHandle(page: Page, container: ElementHandle): Promise<ElementHandle | null> {
    // Try known selectors on the page first
    for (const selector of SLIDER_HANDLE_SELECTORS) {
      try {
        const el = await page.$(selector);
        if (el && (await el.isVisible().catch(() => false))) {
          return el;
        }
      } catch {
        // continue
      }
    }

    // Heuristic fallback: find draggable/interactive element inside container
    try {
      const handle = await container.evaluateHandle((node) => {
        const el = node as HTMLElement;
        // Look for buttons or elements with drag-related attributes
        const candidates: Element[] = [
          ...el.querySelectorAll("button"),
          ...el.querySelectorAll('[draggable="true"]'),
          ...el.querySelectorAll('[role="slider"]'),
        ];

        // Also look for small interactive elements (slider handles are typically < 60px wide)
        const allDivs = el.querySelectorAll("div, span");
        for (const div of allDivs) {
          const rect = div.getBoundingClientRect();
          const style = window.getComputedStyle(div);
          if (
            rect.width > 20 && rect.width < 60 &&
            rect.height > 20 && rect.height < 60 &&
            style.cursor !== "default" &&
            (style.cursor === "pointer" || style.cursor === "grab" || style.cursor === "move")
          ) {
            candidates.push(div);
          }
        }

        return candidates[0] ?? null;
      });

      const element = handle.asElement();
      if (element && (await element.isVisible().catch(() => false))) {
        return element;
      }
    } catch {
      // ignore
    }

    return null;
  }

  /**
   * Find background puzzle image: try known selectors first, fallback to
   * finding the largest <img> inside the container (bg is always ~300-400px wide).
   */
  private async findBgImage(page: Page, container: ElementHandle): Promise<ElementHandle | null> {
    // Try known selectors on the page first
    for (const selector of CAPTCHA_BG_SELECTORS) {
      try {
        const el = await page.$(selector);
        if (el && (await el.isVisible().catch(() => false))) {
          return el;
        }
      } catch {
        // continue
      }
    }

    // Heuristic fallback: find the largest image inside the container
    try {
      const handle = await container.evaluateHandle((node) => {
        const el = node as HTMLElement;
        const imgs = el.querySelectorAll("img");
        let largest: Element | null = null;
        let maxWidth = 0;

        for (const img of imgs) {
          const rect = img.getBoundingClientRect();
          // Background images are typically 300-400px wide
          if (rect.width > maxWidth && rect.width > 100) {
            maxWidth = rect.width;
            largest = img;
          }
        }

        return largest;
      });

      const element = handle.asElement();
      if (element && (await element.isVisible().catch(() => false))) {
        return element;
      }
    } catch {
      // ignore
    }

    return null;
  }

  /**
   * Detect the puzzle gap X position using vertical edge contrast detection.
   *
   * Algorithm:
   * - Convert image to grayscale luminance values
   * - For each column (starting at x=40 to skip the puzzle piece overlay),
   *   sum the absolute brightness difference between adjacent columns
   * - The column with the highest total contrast is the left edge of the gap
   * - Subtract a small offset (~5px) for exact fit
   */
  private async calculatePuzzleDistance(bgBuffer: Buffer): Promise<number> {
    const image = await Jimp.fromBuffer(bgBuffer);
    const { width, height } = image;

    if (width < 60 || height < 20) return 0;

    const grayscale: number[][] = [];
    for (let y = 0; y < height; y++) {
      grayscale[y] = [];
      for (let x = 0; x < width; x++) {
        const pixel = image.getPixelColor(x, y);
        const r = (pixel >>> 24) & 0xff;
        const g = (pixel >>> 16) & 0xff;
        const b = (pixel >>> 8) & 0xff;
        grayscale[y]![x] = 0.299 * r + 0.587 * g + 0.114 * b;
      }
    }

    const startX = 40;
    const endX = width - 10;
    let maxContrast = 0;
    let gapX = 0;

    for (let x = startX; x < endX; x++) {
      let columnContrast = 0;
      for (let y = 0; y < height; y++) {
        const diff = Math.abs(grayscale[y]![x]! - grayscale[y]![x - 1]!);
        columnContrast += diff;
      }

      if (columnContrast > maxContrast) {
        maxContrast = columnContrast;
        gapX = x;
      }
    }

    const offset = 5;
    const distance = Math.max(0, gapX - offset);

    console.log(
      `[Captcha:Slider] 🧩 Puzzle analysis: image=${width}x${height}, gapX=${gapX}, contrast=${maxContrast.toFixed(0)}, distance=${distance}`,
    );

    return distance;
  }
}
