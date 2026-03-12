// ===========================================
// Captcha Module — Shared Types
// ===========================================

import type { ElementHandle, Page } from "playwright";

export enum CaptchaType {
  SLIDER_PUZZLE = "SLIDER_PUZZLE",
  ROTATE_PUZZLE = "ROTATE_PUZZLE",
  OBJECT_MATCH_3D = "OBJECT_MATCH_3D",
  UNKNOWN = "UNKNOWN",
}

export interface CaptchaDetectionResult {
  detected: boolean;
  type: CaptchaType;
  containerElement: ElementHandle | null;
}

export interface CaptchaSolveResult {
  solved: boolean;
  attempts: number;
  type: CaptchaType;
  error?: string;
}

export interface CaptchaStrategy {
  readonly type: CaptchaType;
  readonly maxAttempts: number;
  solve(page: Page, container: ElementHandle): Promise<boolean>;
}

export interface CaptchaSolverOptions {
  platform: "tiktok" | "facebook";
  headless: boolean;
  logPrefix?: string;
}
