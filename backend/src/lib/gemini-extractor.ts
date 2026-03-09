// ===========================================
// Gemini Script Extractor
// ===========================================
// Downloads TikTok video via yt-dlp and transcribes via Gemini Files API

import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { env } from "../config/env.js";

// ===========================================
// Types
// ===========================================

export interface ScriptResult {
  scriptText: string;
  scriptLines: string[];
  sourceMethod: "GEMINI_API" | "DESCRIPTION_FALLBACK";
  language?: string;
}

// ===========================================
// Gemini Script Extractor Class
// ===========================================

export class GeminiScriptExtractor {
  private apiKey: string;

  constructor() {
    this.apiKey = env.gemini.apiKey;
  }

  async extractScript(videoUrl: string, videoId: string, fallbackDescription?: string): Promise<ScriptResult> {
    // Try Gemini API first
    if (this.apiKey) {
      try {
        const tmpPath = await this.downloadVideo(videoUrl, videoId);
        try {
          const fileUri = await this.uploadToGemini(tmpPath);
          const scriptText = await this.transcribeWithGemini(fileUri);
          await fs.unlink(tmpPath).catch(() => {});

          const lines = scriptText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);

          return {
            scriptText,
            scriptLines: lines,
            sourceMethod: "GEMINI_API",
          };
        } finally {
          await fs.unlink(tmpPath).catch(() => {});
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown";
        console.warn(`[Gemini] ⚠️ Gemini extraction failed: ${msg}. Falling back to description.`);
      }
    }

    // Fallback to description
    return this.buildFallback(fallbackDescription);
  }

  private async downloadVideo(videoUrl: string, videoId: string): Promise<string> {
    const tmpPath = path.join("/tmp", `tiktok-${videoId}-${Date.now()}.mp4`);

    return new Promise((resolve, reject) => {
      const args = ["-o", tmpPath, "--quiet", "--no-playlist", videoUrl];

      console.log(`[Gemini] ⬇️ Downloading video ${videoId}...`);

      const proc = spawn("yt-dlp", args, { timeout: 120_000 });
      let stderr = "";

      proc.stderr.on("data", (d) => { stderr += d.toString(); });

      proc.on("close", (code) => {
        if (code === 0) {
          console.log(`[Gemini] ✅ Downloaded to ${tmpPath}`);
          resolve(tmpPath);
        } else {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr.slice(0, 200)}`));
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`yt-dlp spawn error: ${err.message}`));
      });
    });
  }

  private async uploadToGemini(filePath: string): Promise<string> {
    console.log("[Gemini] ⬆️ Uploading to Gemini Files API...");

    // Use dynamic import to avoid top-level module errors if package not installed
    const { GoogleAIFileManager } = await import("@google/generative-ai/server");
    const fileManager = new GoogleAIFileManager(this.apiKey);

    const uploadResult = await fileManager.uploadFile(filePath, {
      mimeType: "video/mp4",
      displayName: path.basename(filePath),
    });

    console.log(`[Gemini] ✅ Uploaded: ${uploadResult.file.uri}`);
    return uploadResult.file.uri;
  }

  private async transcribeWithGemini(fileUri: string): Promise<string> {
    console.log("[Gemini] 🤖 Transcribing with Gemini...");

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: "video/mp4",
          fileUri,
        },
      },
      {
        text: "Transcribe all spoken words in this video. Return only the spoken script as plain text, preserving natural sentence breaks. Do not add any commentary or description.",
      },
    ]);

    const text = result.response.text();
    console.log(`[Gemini] ✅ Transcribed ${text.length} characters`);
    return text;
  }

  private buildFallback(description?: string): ScriptResult {
    const scriptText = description || "(Không có nội dung để trích xuất)";
    const scriptLines = scriptText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    return {
      scriptText,
      scriptLines,
      sourceMethod: "DESCRIPTION_FALLBACK",
    };
  }
}

export const geminiExtractor = new GeminiScriptExtractor();
