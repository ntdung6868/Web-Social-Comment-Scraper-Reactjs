// ===========================================
// Object Match 3D Strategy — Gemini Vision solver
// ===========================================

import type { ElementHandle, Page } from "playwright";
import { CaptchaType, type CaptchaStrategy } from "../types.js";
import { simulateHumanClick } from "../human-interaction.js";
import { getSetting } from "../../../utils/settings.js";
import { env } from "../../../config/env.js";

export class ObjectMatchStrategy implements CaptchaStrategy {
  readonly type = CaptchaType.OBJECT_MATCH_3D;
  readonly maxAttempts = 2; // Gemini costs, fewer retries

  async solve(page: Page, container: ElementHandle): Promise<boolean> {
    // Resolve Gemini API key
    const apiKey = (await getSetting("geminiApiKey")) || env.gemini?.apiKey;
    if (!apiKey) {
      console.warn("[Captcha:ObjectMatch] ❌ No Gemini API key — cannot auto-solve 3D object match.");
      return false;
    }

    try {
      // 1. Screenshot the captcha container
      const screenshot = await container.screenshot();
      const base64Image = screenshot.toString("base64");

      // 2. Send to Gemini for analysis
      const matchPositions = await this.analyzeWithGemini(apiKey, base64Image);
      if (!matchPositions || matchPositions.length !== 2) {
        console.warn("[Captcha:ObjectMatch] ❌ Gemini returned invalid response.");
        return false;
      }

      console.log(`[Captcha:ObjectMatch] 🎯 Gemini identified positions: [${matchPositions.join(", ")}]`);

      // 3. Find grid images and click the matching ones
      const gridImages = await this.findGridImages(container);
      if (gridImages.length < 6) {
        console.warn(`[Captcha:ObjectMatch] ❌ Expected 6 grid images, found ${gridImages.length}.`);
        return false;
      }

      // Click matching images (1-indexed from Gemini response)
      for (const pos of matchPositions) {
        const idx = pos - 1; // Convert to 0-indexed
        if (idx >= 0 && idx < gridImages.length) {
          const imgBox = await gridImages[idx]!.boundingBox();
          if (imgBox) {
            const clickX = imgBox.x + imgBox.width / 2;
            const clickY = imgBox.y + imgBox.height / 2;
            await simulateHumanClick(page, clickX, clickY);
            await page.waitForTimeout(300 + Math.floor(Math.random() * 400));
          }
        }
      }

      // 4. Click confirm/submit button if present
      await this.clickSubmitButton(page, container);

      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown";
      console.error(`[Captcha:ObjectMatch] ❌ Error: ${msg}`);
      return false;
    }
  }

  /**
   * Send captcha screenshot to Gemini for analysis.
   * Returns array of 2 grid positions (1-indexed).
   */
  private async analyzeWithGemini(apiKey: string, base64Image: string): Promise<number[] | null> {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `You are looking at a CAPTCHA challenge screenshot. It contains:
- A reference 3D object shown at the top
- A grid of 6 candidate images (2 rows x 3 columns) below it

Identify exactly 2 images that show the SAME 3D object as the reference.
Grid positions: [1][2][3] / [4][5][6]

Return ONLY a JSON array with exactly 2 numbers, e.g. [1, 4]
Do not include any other text or explanation.`;

      const result = await Promise.race([
        model.generateContent([
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image,
            },
          },
          { text: prompt },
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Gemini timeout")), 15000),
        ),
      ]);

      const text = result.response.text().trim();
      console.log(`[Captcha:ObjectMatch] 🤖 Gemini raw response: ${text}`);

      // Parse JSON array from response
      const match = text.match(/\[[\s\d,]+\]/);
      if (!match) return null;

      const parsed = JSON.parse(match[0]) as number[];

      // Validate: must be array of 2, values 1-6
      if (
        !Array.isArray(parsed) ||
        parsed.length !== 2 ||
        parsed.some((n) => typeof n !== "number" || n < 1 || n > 6)
      ) {
        return null;
      }

      return parsed;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown";
      console.error(`[Captcha:ObjectMatch] ❌ Gemini call failed: ${msg}`);
      return null;
    }
  }

  /**
   * Find grid images inside the container, filtered by size and sorted by position.
   */
  private async findGridImages(container: ElementHandle): Promise<ElementHandle[]> {
    try {
      const allImgs = await container.$$("img");
      const gridImgs: Array<{ el: ElementHandle; x: number; y: number }> = [];

      for (const img of allImgs) {
        const box = await img.boundingBox();
        if (!box) continue;

        // Grid images are typically 50-150px
        if (box.width >= 40 && box.width <= 200 && box.height >= 40 && box.height <= 200) {
          gridImgs.push({ el: img, x: box.x, y: box.y });
        }
      }

      // Sort by position: top-to-bottom, left-to-right (grid order)
      gridImgs.sort((a, b) => {
        const rowDiff = a.y - b.y;
        // Same row if within 20px vertical distance
        if (Math.abs(rowDiff) < 20) return a.x - b.x;
        return rowDiff;
      });

      return gridImgs.map((g) => g.el);
    } catch {
      return [];
    }
  }

  /**
   * Click the confirm/submit button if present inside or near the container.
   */
  private async clickSubmitButton(page: Page, container: ElementHandle): Promise<void> {
    const submitSelectors = [
      'button[class*="verify"]',
      'button[class*="submit"]',
      'button[class*="confirm"]',
      'div[class*="verify"][class*="btn"]',
      'div[class*="submit"]',
    ];

    for (const selector of submitSelectors) {
      try {
        // Try inside container first
        let btn = await container.$(selector);
        if (!btn) {
          // Try on the page level
          btn = await page.$(selector);
        }
        if (btn && (await btn.isVisible().catch(() => false))) {
          const box = await btn.boundingBox();
          if (box) {
            await simulateHumanClick(page, box.x + box.width / 2, box.y + box.height / 2);
            console.log("[Captcha:ObjectMatch] ✅ Clicked submit button.");
            return;
          }
        }
      } catch {
        // continue
      }
    }
  }
}
