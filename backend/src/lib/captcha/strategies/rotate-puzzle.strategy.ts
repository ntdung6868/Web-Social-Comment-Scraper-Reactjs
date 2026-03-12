// ===========================================
// Rotate Puzzle Strategy — Seam Matching solver
// ===========================================
// Solves TikTok's concentric circular rotate CAPTCHA using pure local
// computer vision. No external AI/Gemini APIs.
//
// Algorithm: The captcha image is a square (~340x340) with a circular inner
// disc cut at radius R from the center. When the disc is rotated to the
// correct position, the pixels just inside the cut (inner ring) align
// seamlessly with the pixels just outside (outer ring). We sample both
// rings at 1-degree intervals around 360 degrees, then brute-force every
// possible rotation shift (0-359) to find the one that minimises the total
// colour difference between the two rings.

import type { ElementHandle, Page } from "playwright";
import { Jimp } from "jimp";
import { CaptchaType, type CaptchaStrategy } from "../types.js";
import { simulateHumanDrag } from "../human-interaction.js";

// Selectors for the captcha image element (same ones shared with slider)
const CAPTCHA_IMAGE_SELECTORS = [
  "#captcha-verify-image",
  ".captcha_verify_img_slide",
  '[class*="captcha"] img[src*="captcha"]',
  ".verify-image img",
  'img[class*="captcha"]',
];

// Selectors for the slider handle
const SLIDER_HANDLE_SELECTORS = [
  ".secsdk-captcha-drag-icon",
  ".sc-slider-btn",
  '[class*="captcha"] [class*="drag"]',
  '[class*="slider"] button',
  ".captcha-slider-btn",
];

// Selectors for the slider track (to measure its width)
const SLIDER_TRACK_SELECTORS = [
  ".secsdk-captcha-drag-wrapper",
  '[class*="captcha"] [class*="slider"]',
  '[class*="captcha"] [class*="drag-wrapper"]',
  '[class*="slider-track"]',
  '[class*="slide-track"]',
];

// Fixed cut radius for TikTok's 340x340 rotate captcha.
// Dynamic detection was unreliable (grabbing inner noise at 33px, etc.).
// The cut radius is a static property of TikTok's captcha image template.
const RADIUS = 104;

// Radii to average for each ring's 1D signal.
// Dead zone: R ± 2 (px 103-105 are blurred by the cut border).
// Outer ring: average of 3 consecutive px at R+2, R+3, R+4 (radii 106-108)
// Inner ring: average of 3 consecutive px at R-2, R-3, R-4 (radii 100-102)
// This gives a tight 4px gap (102 → 106) ensuring texture coherence.
const OUTER_SMOOTH_RADII = [106, 107, 108];
const INNER_SMOOTH_RADII = [100, 101, 102];

// Circumferential derivative step in degrees.
// A 5° step acts as a low-pass filter — ignoring single-pixel JPEG noise
// while preserving strong structural edges (texture transitions).
const GRAD_STEP = 5;

// --- Slider calibration ---
// Pixels to subtract from (trackWidth - handleWidth) to account for hidden
// CSS padding/margins inside TikTok's slider track element.
const SLIDER_TRACK_PADDING = 12;
// Fine-tuning multiplier applied after padding subtraction.
// Use < 1.0 (e.g. 0.98) if the drag consistently overshoots,
// or > 1.0 (e.g. 1.02) if it consistently undershoots.
const DRAG_MULTIPLIER = 1.0;
// Total *relative* degrees of rotation over the full slider track.
// TikTok uses dual counter-rotation: dragging the slider rotates the inner
// circle CW while simultaneously rotating the outer circle CCW. The
// relative angular velocity is doubled, so a full track drag produces 720°
// of relative phase shift (inner +360° + outer −360°), not 360°.
const RELATIVE_TRACK_DEGREES = 720;

// When true, the angle is reversed: distanceX uses (360 - angle).
// Toggle this if visual debug shows correct angle but the disc spins the
// wrong direction in the UI.
const REVERSE_ANGLE = false;

// Pixel colours for debug overlay (RRGGBBAA packed uint32)
const DEBUG_RED = 0xff0000ff;
const DEBUG_GREEN = 0x00ff00ff;

export class RotatePuzzleStrategy implements CaptchaStrategy {
  readonly type = CaptchaType.ROTATE_PUZZLE;
  readonly maxAttempts = 3;

  async solve(page: Page, container: ElementHandle): Promise<boolean> {
    // 1. Find the captcha image
    const imgElement = await this.findCaptchaImage(page, container);
    if (!imgElement) {
      console.warn("[Captcha:Rotate] ❌ Captcha image not found.");
      return false;
    }

    // 2. Find the slider handle
    const sliderHandle = await this.findSliderHandle(page, container);
    if (!sliderHandle) {
      console.warn("[Captcha:Rotate] ❌ Slider handle not found.");
      return false;
    }

    // 3. Get bounding boxes for both track and handle
    const handleBox = await sliderHandle.boundingBox();
    if (!handleBox) {
      console.warn("[Captcha:Rotate] ❌ Cannot get handle bounding box.");
      return false;
    }

    const trackBox = await this.measureSliderTrackBox(page, container);
    if (!trackBox || trackBox.width <= 0) {
      console.warn("[Captcha:Rotate] ❌ Could not measure slider track.");
      return false;
    }

    // The maximum distance the handle CENTER can travel is:
    //   track width  −  handle width  −  internal CSS padding
    // then scaled by the fine-tuning multiplier.
    const rawMaxDrag = trackBox.width - handleBox.width;
    const calibratedMaxDrag = (rawMaxDrag - SLIDER_TRACK_PADDING) * DRAG_MULTIPLIER;
    if (calibratedMaxDrag <= 0) {
      console.warn("[Captcha:Rotate] ❌ calibratedMaxDrag <= 0.");
      return false;
    }

    // 4. Screenshot the captcha image and compute rotation angle
    const imgBuffer = await imgElement.screenshot();
    const bestAngle = await this.calculateRotationAngle(imgBuffer);

    if (bestAngle <= 0) {
      console.warn("[Captcha:Rotate] ❌ Could not determine rotation angle.");
      return false;
    }

    console.log(`[Captcha:Rotate] 🔄 Best rotation angle: ${bestAngle}°`);

    // 5. Convert angle to slider pixel distance, accounting for dual rotation.
    // The seam-matching algorithm returns the *relative* angle between the
    // two rings. Because both rings rotate in opposite directions, the full
    // slider track corresponds to RELATIVE_TRACK_DEGREES (default 720°) of
    // relative phase shift, not a simple 360°.
    const effectiveAngle = REVERSE_ANGLE ? RELATIVE_TRACK_DEGREES - bestAngle : bestAngle;
    const distanceX = Math.round((effectiveAngle / RELATIVE_TRACK_DEGREES) * calibratedMaxDrag);
    console.log(
      `[Captcha:Rotate] 📐 Dual-rotation math: bestAngle=${bestAngle}°, ` +
      `relativeTrackDeg=${RELATIVE_TRACK_DEGREES}, distanceX=${distanceX}px ` +
      `(calibrated=${calibratedMaxDrag.toFixed(1)}px, raw=${rawMaxDrag.toFixed(0)}px, ` +
      `padding=${SLIDER_TRACK_PADDING}, mult=${DRAG_MULTIPLIER}, ` +
      `track=${trackBox.width.toFixed(0)}px, handle=${handleBox.width.toFixed(0)}px, ` +
      `reverse=${REVERSE_ANGLE})`,
    );

    // 6. Drag the slider
    await simulateHumanDrag(page, sliderHandle, distanceX);

    return true;
  }

  // ===========================================
  // Seam Matching — Core Algorithm
  // ===========================================

  /**
   * Calculate the rotation angle using 1D Smoothed Signal Processing.
   *
   * Key improvements over previous approaches:
   * - Radial smoothing: average 3 adjacent pixels (e.g. R=106,107,108) to
   *   produce a single noise-reduced grayscale value per degree. This keeps
   *   the sample tight (4px gap between rings) for texture coherence.
   * - 5-degree gradient step: the circumferential derivative uses a 5°
   *   window instead of 1°. This acts as a low-pass filter — single-pixel
   *   JPEG artifacts vanish while strong texture edges are preserved.
   * - Brightness/contrast invariant: gradients cancel DC offset and resist
   *   multiplicative gain differences between inner and outer pieces.
   *
   * Pipeline:
   * 1. Build two 1D signals (outerRing, innerRing) of 360 smoothed values.
   * 2. Compute 5° circumferential gradients for each signal.
   * 3. Brute-force 360 shifts, minimising SAD of gradient signals.
   * 4. Save visual debug image (RED at R=107, GREEN at R=101).
   */
  async calculateRotationAngle(imgBuffer: Buffer): Promise<number> {
    const image = await Jimp.fromBuffer(imgBuffer);
    const { width, height } = image;

    if (width < 100 || height < 100) return 0;

    const cx = width / 2;
    const cy = height / 2;

    console.log(
      `[Captcha:Rotate] 🖼️ Image size: ${width}x${height}, center: (${cx.toFixed(0)}, ${cy.toFixed(0)}), ` +
      `locked RADIUS=${RADIUS}px`,
    );
    console.log(
      `[Captcha:Rotate] 📏 Outer smooth radii: [${OUTER_SMOOTH_RADII.join(",")}], ` +
      `Inner smooth radii: [${INNER_SMOOTH_RADII.join(",")}], gradStep=${GRAD_STEP}°`,
    );

    // ── Step 1: Build radially-smoothed 1D signals ──────────────────
    // For each degree, average the grayscale of 3 adjacent radii on each
    // side of the cut. This produces a clean 1D circumferential signal.

    const outerRing: number[] = new Array(360);
    const innerRing: number[] = new Array(360);

    // Debug coordinates: plot the middle radius of each ring
    const outerDebugCoords: Array<{ x: number; y: number }> = new Array(360);
    const innerDebugCoords: Array<{ x: number; y: number }> = new Array(360);

    const outerCount = OUTER_SMOOTH_RADII.length;
    const innerCount = INNER_SMOOTH_RADII.length;

    // Middle radius for debug dots
    const outerDebugR = OUTER_SMOOTH_RADII[Math.floor(outerCount / 2)]!;
    const innerDebugR = INNER_SMOOTH_RADII[Math.floor(innerCount / 2)]!;

    for (let deg = 0; deg < 360; deg++) {
      const rad = (deg * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      // Outer ring: average grayscale across OUTER_SMOOTH_RADII
      let outerSum = 0;
      for (let k = 0; k < outerCount; k++) {
        const r = OUTER_SMOOTH_RADII[k]!;
        const x = Math.round(cx + r * cosA);
        const y = Math.round(cy + r * sinA);
        outerSum +=
          x >= 0 && x < width && y >= 0 && y < height
            ? this.getPixelGray(image, x, y)
            : 0;
      }
      outerRing[deg] = outerSum / outerCount;

      // Inner ring: average grayscale across INNER_SMOOTH_RADII
      let innerSum = 0;
      for (let k = 0; k < innerCount; k++) {
        const r = INNER_SMOOTH_RADII[k]!;
        const x = Math.round(cx + r * cosA);
        const y = Math.round(cy + r * sinA);
        innerSum +=
          x >= 0 && x < width && y >= 0 && y < height
            ? this.getPixelGray(image, x, y)
            : 0;
      }
      innerRing[deg] = innerSum / innerCount;

      // Debug coordinates at middle radius
      outerDebugCoords[deg] = {
        x: Math.round(cx + outerDebugR * cosA),
        y: Math.round(cy + outerDebugR * sinA),
      };
      innerDebugCoords[deg] = {
        x: Math.round(cx + innerDebugR * cosA),
        y: Math.round(cy + innerDebugR * sinA),
      };
    }

    // ── Step 2: Compute 5° circumferential gradients ────────────────
    // grad[deg] = ring[deg] - ring[(deg - GRAD_STEP + 360) % 360]
    // The wider step filters out single-pixel noise while preserving
    // the strong structural edges that define the texture pattern.

    const outerGrad: number[] = new Array(360);
    const innerGrad: number[] = new Array(360);

    for (let deg = 0; deg < 360; deg++) {
      const prev = (deg - GRAD_STEP + 360) % 360;
      outerGrad[deg] = outerRing[deg]! - outerRing[prev]!;
      innerGrad[deg] = innerRing[deg]! - innerRing[prev]!;
    }

    // ── Step 3: Brute-force SAD matching on gradient signals ────────

    let minDiff = Infinity;
    let bestAngle = 0;

    for (let shift = 0; shift < 360; shift++) {
      let currentDiff = 0;

      for (let deg = 0; deg < 360; deg++) {
        currentDiff += Math.abs(outerGrad[deg]! - innerGrad[(deg + shift) % 360]!);
      }

      if (currentDiff < minDiff) {
        minDiff = currentDiff;
        bestAngle = shift;
      }
    }

    console.log(
      `[Captcha:Rotate] 🧩 Gradient analysis: bestAngle=${bestAngle}°, ` +
      `minDiff=${minDiff.toFixed(0)}, ` +
      `avgGradDiff=${(minDiff / 360).toFixed(1)} ` +
      `(360 grad comparisons/shift, step=${GRAD_STEP}°)`,
    );

    // ── Step 4: Visual debug ────────────────────────────────────────
    await this.saveDebugImage(image, outerDebugCoords, innerDebugCoords, RADIUS, bestAngle);

    return bestAngle;
  }

  // ===========================================
  // Visual Debug
  // ===========================================

  /**
   * Paint the sampled outer ring (RED) and inner ring (GREEN) pixels onto
   * a copy of the captcha image so we can visually verify the algorithm is
   * sampling the correct seam, not random background noise.
   *
   * Also draws a 3x3 block for each point so it's visible on high-res images.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async saveDebugImage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sourceImage: any,
    outerCoords: Array<{ x: number; y: number }>,
    innerCoords: Array<{ x: number; y: number }>,
    radius: number,
    bestAngle: number,
  ): Promise<void> {
    try {
      // Clone so we don't mutate the original
      const debug = sourceImage.clone();
      const { width, height } = debug;

      const paintBlock = (cx: number, cy: number, color: number) => {
        // 3x3 block for visibility
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const px = cx + dx;
            const py = cy + dy;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              debug.setPixelColor(color, px, py);
            }
          }
        }
      };

      // Draw outer ring samples as RED
      for (let i = 0; i < 360; i++) {
        const { x, y } = outerCoords[i]!;
        paintBlock(x, y, DEBUG_RED);
      }

      // Draw inner ring samples as GREEN
      for (let i = 0; i < 360; i++) {
        const { x, y } = innerCoords[i]!;
        paintBlock(x, y, DEBUG_GREEN);
      }

      const debugPath = `/tmp/captcha-rotate-debug-${Date.now()}.png`;
      await debug.write(debugPath);
      console.log(
        `[Captcha:Rotate] 🖼️ Debug image saved: ${debugPath} ` +
        `(R=${radius}, outer=[${OUTER_RADII.join(",")}], inner=[${INNER_RADII.join(",")}], angle=${bestAngle}°)`,
      );
    } catch (err) {
      // Debug image is non-critical — don't let it break the solve flow
      console.warn("[Captcha:Rotate] ⚠️ Could not save debug image:", err instanceof Error ? err.message : err);
    }
  }

  // ===========================================
  // Pixel Helpers
  // ===========================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getPixelGray(image: any, x: number, y: number): number {
    const pixel = image.getPixelColor(x, y);
    const r = (pixel >>> 24) & 0xff;
    const g = (pixel >>> 16) & 0xff;
    const b = (pixel >>> 8) & 0xff;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // ===========================================
  // DOM Element Finders
  // ===========================================

  private async findCaptchaImage(page: Page, container: ElementHandle): Promise<ElementHandle | null> {
    // Try known selectors on the page
    for (const selector of CAPTCHA_IMAGE_SELECTORS) {
      try {
        const el = await page.$(selector);
        if (el && (await el.isVisible().catch(() => false))) {
          return el;
        }
      } catch {
        // continue
      }
    }

    // Heuristic fallback: find the largest roughly-square image inside the
    // container (rotate captcha images are square, ~340x340)
    try {
      const handle = await container.evaluateHandle((node) => {
        const el = node as HTMLElement;
        const imgs = el.querySelectorAll("img");
        let best: Element | null = null;
        let bestArea = 0;

        for (const img of imgs) {
          const rect = img.getBoundingClientRect();
          // Must be roughly square and large enough to be the captcha image
          const ratio = rect.width / (rect.height || 1);
          if (rect.width > 150 && ratio > 0.8 && ratio < 1.25) {
            const area = rect.width * rect.height;
            if (area > bestArea) {
              bestArea = area;
              best = img;
            }
          }
        }

        return best;
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

  private async findSliderHandle(page: Page, container: ElementHandle): Promise<ElementHandle | null> {
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

    // Heuristic fallback: small interactive element inside container
    try {
      const handle = await container.evaluateHandle((node) => {
        const el = node as HTMLElement;
        const candidates: Element[] = [
          ...el.querySelectorAll("button"),
          ...el.querySelectorAll('[draggable="true"]'),
          ...el.querySelectorAll('[role="slider"]'),
        ];

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
   * Get the bounding box of the slider track.
   *
   * The maximum draggable distance is computed by the caller as:
   *   track.width − handle.width
   */
  private async measureSliderTrackBox(
    page: Page,
    container: ElementHandle,
  ): Promise<{ width: number; height: number } | null> {
    // Try known track selectors
    for (const selector of SLIDER_TRACK_SELECTORS) {
      try {
        const el = await page.$(selector);
        if (el && (await el.isVisible().catch(() => false))) {
          const box = await el.boundingBox();
          if (box && box.width > 100) {
            return { width: box.width, height: box.height };
          }
        }
      } catch {
        // continue
      }
    }

    // Heuristic fallback: find the widest horizontal element in container
    // that looks like a track (width > 200, height < 80)
    try {
      const result = await container.evaluate((node) => {
        const el = node as HTMLElement;
        const allEls = el.querySelectorAll("div, span");
        let bestWidth = 0;
        let bestHeight = 0;

        for (const child of allEls) {
          const rect = child.getBoundingClientRect();
          if (rect.width > 200 && rect.height > 15 && rect.height < 80 && rect.width > bestWidth) {
            bestWidth = rect.width;
            bestHeight = rect.height;
          }
        }

        return bestWidth > 0 ? { width: bestWidth, height: bestHeight } : null;
      });

      if (result && result.width > 100) {
        return result;
      }
    } catch {
      // ignore
    }

    // Last fallback: common TikTok slider track width
    console.warn("[Captcha:Rotate] ⚠️ Using fallback track width of 300px.");
    return { width: 300, height: 40 };
  }
}
