// ===========================================
// Human-like Interaction Helpers
// ===========================================
// Extracted from TikTokScraper — shared by all captcha strategies

import type { ElementHandle, Page } from "playwright";

/**
 * Generate cubic Bezier curve points for natural mouse trajectory.
 * Control points are randomized to avoid deterministic paths.
 */
export function generateBezierPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps: number,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];

  const cp1x = startX + (endX - startX) * (0.2 + Math.random() * 0.15);
  const cp1y = startY + (Math.random() * 2 - 1) * 8;
  const cp2x = startX + (endX - startX) * (0.6 + Math.random() * 0.2);
  const cp2y = endY + (Math.random() * 2 - 1) * 6;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;

    const x = u * u * u * startX + 3 * u * u * t * cp1x + 3 * u * t * t * cp2x + t * t * t * endX;
    const y = u * u * u * startY + 3 * u * u * t * cp1y + 3 * u * t * t * cp2y + t * t * t * endY;

    points.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }

  return points;
}

/**
 * Apply ease-out timing: fast start, slow finish.
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Add Y-axis micro-jitter to simulate natural hand tremor during drag.
 */
export function addMicroJitter(y: number): number {
  return y + (Math.random() * 5 - 2);
}

/**
 * Simulate a realistic human-like slider drag to solve captcha puzzles.
 *
 * Anti-detect features:
 * 1. Bezier curve trajectory (non-linear path)
 * 2. Ease-out speed dynamics (fast start, slow finish with hesitation)
 * 3. Y-axis micro-jitter (hand tremor simulation)
 * 4. Overshoot & correction (drag past target, pause, slide back)
 * 5. Randomized timing between each move step
 */
export async function simulateHumanDrag(
  page: Page,
  sliderHandleElement: ElementHandle,
  distanceX: number,
): Promise<void> {
  const box = await sliderHandleElement.boundingBox();
  if (!box) throw new Error("Cannot get slider handle bounding box");

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // --- Phase 1: Overshoot past the target ---
  const overshootPx = 3 + Math.random() * 5;
  const overshootTargetX = startX + distanceX + overshootPx;

  const mainSteps = 35 + Math.floor(Math.random() * 20);
  const mainPath = generateBezierPath(startX, startY, overshootTargetX, startY, mainSteps);

  await page.mouse.move(startX, startY);
  await page.waitForTimeout(80 + Math.floor(Math.random() * 120));
  await page.mouse.down();
  await page.waitForTimeout(50 + Math.floor(Math.random() * 80));

  for (let i = 1; i < mainPath.length; i++) {
    const progress = i / (mainPath.length - 1);
    const easedProgress = easeOutCubic(progress);

    const targetX = startX + (overshootTargetX - startX) * easedProgress;
    const targetY = addMicroJitter(mainPath[i]!.y);

    await page.mouse.move(targetX, targetY);

    const baseDelay = progress < 0.5
      ? 5 + Math.floor(Math.random() * 6)
      : 15 + Math.floor(Math.random() * 21);

    const hesitation = progress > 0.6 && Math.random() < 0.1
      ? 40 + Math.floor(Math.random() * 60)
      : 0;

    await page.waitForTimeout(baseDelay + hesitation);
  }

  // --- Phase 2: Pause at overshoot position ---
  await page.waitForTimeout(120 + Math.floor(Math.random() * 180));

  // --- Phase 3: Correct back to exact target ---
  const correctionTargetX = startX + distanceX;
  const correctionSteps = 8 + Math.floor(Math.random() * 6);
  const currentX = overshootTargetX;
  const currentY = startY;

  for (let i = 1; i <= correctionSteps; i++) {
    const t = i / correctionSteps;
    const eased = t * t;
    const x = currentX + (correctionTargetX - currentX) * eased;
    const y = addMicroJitter(currentY);

    await page.mouse.move(x, y);
    await page.waitForTimeout(15 + Math.floor(Math.random() * 25));
  }

  await page.mouse.move(correctionTargetX, startY);
  await page.waitForTimeout(50 + Math.floor(Math.random() * 100));

  await page.mouse.up();
  await page.waitForTimeout(200 + Math.floor(Math.random() * 300));

  console.log(
    `[Captcha] ✅ Slider dragged ${distanceX}px (overshoot: +${overshootPx.toFixed(1)}px, corrected back)`,
  );
}

/**
 * Simulate a human-like click at given coordinates.
 * Hover with jitter → random delay → mousedown → short hold → mouseup.
 */
export async function simulateHumanClick(page: Page, x: number, y: number): Promise<void> {
  // Hover near the target first with slight offset
  const hoverX = x + (Math.random() * 4 - 2);
  const hoverY = y + (Math.random() * 4 - 2);
  await page.mouse.move(hoverX, hoverY);
  await page.waitForTimeout(50 + Math.floor(Math.random() * 100));

  // Move to exact position
  await page.mouse.move(x, y);
  await page.waitForTimeout(30 + Math.floor(Math.random() * 60));

  // Click with human-like hold duration
  await page.mouse.down();
  await page.waitForTimeout(40 + Math.floor(Math.random() * 80));
  await page.mouse.up();
  await page.waitForTimeout(100 + Math.floor(Math.random() * 150));
}
