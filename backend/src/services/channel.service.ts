// ===========================================
// Channel Service
// ===========================================
// Business logic for TikTok channel crawl + script extraction

import type { Job } from "bullmq";
import { channelRepository } from "../repositories/channel.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { createError } from "../middlewares/error.middleware.js";
import { proxyManager } from "../lib/scraper/index.js";
import {
  addChannelCrawlJob,
  addScriptExtractionJob,
  registerChannelProcessor,
  userHasActiveChannelJob,
  type ChannelCrawlJobData,
  type ScriptExtractionJobData,
  type ChannelJobResult,
} from "../lib/channel-queue.js";
import { TikTokChannelScraper } from "../lib/scraper/tiktok-channel.scraper.js";
import { geminiExtractor } from "../lib/gemini-extractor.js";
import {
  emitChannelCrawlProgress,
  emitChannelCrawlCompleted,
  emitChannelCrawlFailed,
  emitChannelExtractProgress,
  emitChannelExtractCompleted,
  emitChannelExtractFailed,
} from "../lib/socket.js";
import type { ProxyRotation } from "../types/enums.js";
import ExcelJS from "exceljs";
import { getChannelLimits, getSetting } from "../utils/settings.js";

// ===========================================
// Channel Service Class
// ===========================================

export class ChannelService {
  private isProcessorRegistered = false;

  constructor() {
    this.registerProcessors().catch((err) =>
      console.error("[ChannelService] Failed to register processors:", err),
    );
  }

  // ===========================================
  // Phase 1: Channel Crawl
  // ===========================================

  async startChannelCrawl(
    userId: string,
    data: { channelUrl: string; minViews: number; maxVideos: number },
  ) {
    // Check if user can use the service
    const canScrape = await userRepository.canScrape(userId);
    if (!canScrape.canScrape) {
      throw createError.forbidden(canScrape.message, "CHANNEL_LIMIT_REACHED");
    }

    // Prevent duplicate active jobs
    if (userHasActiveChannelJob(userId)) {
      throw createError.conflict(
        "You already have a channel crawl running. Please wait for it to finish.",
      );
    }

    const user = await userRepository.findById(userId);
    if (!user) throw createError.notFound("User not found");

    // Extract username from URL
    const usernameMatch = data.channelUrl.match(/@([\w.-]+)/);
    const channelUsername = usernameMatch ? `@${usernameMatch[1]}` : data.channelUrl;

    // Apply plan limits
    const effectiveMaxVideos = await this.applyPlanLimits(user.planType, data.maxVideos);

    // Resolve cookies
    let cookieData: string | null = null;
    let userAgent: string | null = null;
    if (user.useTiktokCookie && user.tiktokCookieData) {
      cookieData = user.tiktokCookieData;
      userAgent = user.tiktokCookieUserAgent;
    }

    // Resolve proxy: user proxy > system proxy setting > env PROXY_URL
    let proxy: string | null = null;
    if (user.proxyEnabled && user.proxyList) {
      proxyManager.setProxies(user.proxyList, user.proxyRotation as ProxyRotation | undefined);
      proxy = proxyManager.getNext();
    }
    if (!proxy) {
      const systemProxy = await getSetting("proxyUrl");
      if (systemProxy) proxy = systemProxy;
    }

    // Create DB record
    const crawlJob = await channelRepository.createCrawlJob({
      userId,
      channelUrl: data.channelUrl,
      channelUsername,
      minViews: data.minViews,
      maxVideos: effectiveMaxVideos,
    });

    // Enqueue
    const jobData: ChannelCrawlJobData = {
      crawlJobId: crawlJob.id,
      userId,
      channelUrl: data.channelUrl,
      channelUsername,
      minViews: data.minViews,
      maxVideos: effectiveMaxVideos,
      planType: user.planType as "FREE" | "PERSONAL" | "PREMIUM",
      cookies: { data: cookieData, userAgent },
      proxy,
      headless: user.headlessMode,
    };

    await addChannelCrawlJob(jobData);

    // Deduct trial for FREE users
    if (user.planType === "FREE") {
      await userRepository.useTrialScrape(userId);
    }

    return { crawlJobId: crawlJob.id };
  }

  // ===========================================
  // Phase 2: Script Extraction
  // ===========================================

  async startScriptExtraction(userId: string, data: { crawlJobId: string; videoIds: string[] }) {
    const isOwner = await channelRepository.isJobOwner(data.crawlJobId, userId);
    if (!isOwner) throw createError.forbidden("Access denied");

    const crawlJob = await channelRepository.getCrawlJob(data.crawlJobId);
    if (!crawlJob) throw createError.notFound("Crawl job not found");
    if (crawlJob.status !== "COMPLETED") {
      throw createError.badRequest("Crawl job must be completed before extracting scripts");
    }

    const user = await userRepository.findById(userId);
    if (!user) throw createError.notFound("User not found");

    const maxExtract = await this.getMaxExtractVideos(user.planType);
    const videoIds = data.videoIds.slice(0, maxExtract);

    await addScriptExtractionJob({
      crawlJobId: data.crawlJobId,
      userId,
      videoIds,
    });

    return { crawlJobId: data.crawlJobId, videoCount: videoIds.length };
  }

  // ===========================================
  // Query Operations
  // ===========================================

  async getChannelCrawlStatus(crawlJobId: string, userId: string) {
    const isOwner = await channelRepository.isJobOwner(crawlJobId, userId);
    if (!isOwner) throw createError.forbidden("Access denied");

    return channelRepository.getCrawlJob(crawlJobId);
  }

  async getFilteredVideos(crawlJobId: string, userId: string) {
    const isOwner = await channelRepository.isJobOwner(crawlJobId, userId);
    if (!isOwner) throw createError.forbidden("Access denied");

    return channelRepository.getFilteredVideos(crawlJobId);
  }

  async getScriptResults(crawlJobId: string, userId: string) {
    const isOwner = await channelRepository.isJobOwner(crawlJobId, userId);
    if (!isOwner) throw createError.forbidden("Access denied");

    return channelRepository.getScriptResults(crawlJobId);
  }

  async getCrawlHistory(userId: string, page: number, limit: number) {
    return channelRepository.getCrawlJobsByUser(userId, page, limit);
  }

  async deleteCrawlJob(crawlJobId: string, userId: string) {
    const isOwner = await channelRepository.isJobOwner(crawlJobId, userId);
    if (!isOwner) throw createError.forbidden("Access denied");

    await channelRepository.deleteCrawlJob(crawlJobId);
  }

  // ===========================================
  // Export
  // ===========================================

  async exportScripts(crawlJobId: string, userId: string, format: "xlsx" | "csv" | "json") {
    const isOwner = await channelRepository.isJobOwner(crawlJobId, userId);
    if (!isOwner) throw createError.forbidden("Access denied");

    const [crawlJob, scriptResults] = await Promise.all([
      channelRepository.getCrawlJob(crawlJobId),
      channelRepository.getScriptResults(crawlJobId),
    ]);

    if (!crawlJob) throw createError.notFound("Crawl job not found");

    const rows = scriptResults.map((sr) => ({
      videoUrl: sr.video.videoUrl,
      views: sr.video.views,
      likes: sr.video.likes,
      description: sr.video.description ?? "",
      script: sr.scriptText,
      sourceMethod: sr.sourceMethod,
      extractedAt: sr.extractedAt.toISOString(),
    }));

    if (format === "json") {
      return {
        type: "json" as const,
        data: {
          channelUrl: crawlJob.channelUrl,
          channelUsername: crawlJob.channelUsername,
          exportedAt: new Date().toISOString(),
          totalScripts: rows.length,
          scripts: rows,
        },
      };
    }

    if (format === "csv") {
      let csv = "Video URL,Views,Likes,Description,Script,Source,Extracted At\n";
      for (const r of rows) {
        const esc = (s: string) => `"${s.replace(/"/g, '""').replace(/\n/g, " ")}"`;
        csv += `${r.videoUrl},${r.views},${r.likes},${esc(r.description)},${esc(r.script)},${r.sourceMethod},${r.extractedAt}\n`;
      }
      return { type: "csv" as const, data: csv };
    }

    // XLSX
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Scripts");
    ws.addRow(["Channel URL", crawlJob.channelUrl]);
    ws.addRow(["Channel", crawlJob.channelUsername]);
    ws.addRow(["Exported At", new Date().toISOString()]);
    ws.addRow([]);
    const headerRow = ws.addRow(["Video URL", "Views", "Likes", "Description", "Script", "Source", "Extracted At"]);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    for (const r of rows) {
      ws.addRow([r.videoUrl, r.views, r.likes, r.description, r.script, r.sourceMethod, r.extractedAt]);
    }
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const len = cell.value?.toString().length ?? 0;
        if (len > max) max = Math.min(len, 60);
      });
      col.width = max + 2;
    });
    return { type: "xlsx" as const, workbook };
  }

  // ===========================================
  // Plan Limits
  // ===========================================

  private async applyPlanLimits(planType: string, requested: number): Promise<number> {
    const { maxVideos } = await getChannelLimits();
    return Math.min(requested, maxVideos[planType] ?? 20);
  }

  private async getMaxExtractVideos(planType: string): Promise<number> {
    const { maxExtract } = await getChannelLimits();
    return maxExtract[planType] ?? 5;
  }

  // ===========================================
  // Job Processors
  // ===========================================

  private async registerProcessors(): Promise<void> {
    if (this.isProcessorRegistered) return;

    await registerChannelProcessor(
      // Channel crawl processor
      async (job: Job<ChannelCrawlJobData>): Promise<ChannelJobResult> => {
        const { crawlJobId, userId, channelUrl, minViews, maxVideos, cookies, proxy, headless } = job.data;
        const startTime = Date.now();

        try {
          await channelRepository.updateCrawlJobStatus(crawlJobId, "RUNNING");

          emitChannelCrawlProgress(userId, {
            crawlJobId,
            videosFound: 0,
            message: "Đang khởi tạo trình duyệt...",
            timestamp: new Date(),
          });

          const scraper = new TikTokChannelScraper({
            userId,
            crawlJobId,
            cookies,
            proxy,
            headless,
            minViews,
            maxVideos,
          });

          const videos = await scraper.crawlChannel(channelUrl);

          // If 0 videos and no proxy configured → likely VPS IP blocked by TikTok
          if (videos.length === 0 && !proxy) {
            const errMsg =
              "Không tìm thấy video. Server có thể bị TikTok chặn do IP datacenter. " +
              "Vui lòng cấu hình PROXY_URL trong System Settings hoặc file .env để khắc phục.";
            await channelRepository.updateCrawlJobStatus(crawlJobId, "FAILED", { errorMessage: errMsg });
            emitChannelCrawlFailed(userId, { crawlJobId, error: errMsg, timestamp: new Date() });
            return { crawlJobId, success: false, error: errMsg };
          }

          emitChannelCrawlProgress(userId, {
            crawlJobId,
            videosFound: videos.length,
            message: `Đang lưu ${videos.length} video...`,
            timestamp: new Date(),
          });

          await channelRepository.saveVideos(crawlJobId, videos);
          const filtered = videos.filter((v) => v.meetsFilter).length;

          await channelRepository.updateCrawlJobStatus(crawlJobId, "COMPLETED", {
            totalVideos: videos.length,
            filteredVideos: filtered,
          });

          const duration = Date.now() - startTime;

          emitChannelCrawlCompleted(userId, {
            crawlJobId,
            totalVideos: videos.length,
            filteredVideos: filtered,
            duration,
            message: `Hoàn thành! ${filtered} video đạt ngưỡng lọc.`,
            timestamp: new Date(),
          });

          return { crawlJobId, success: true };
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Unknown error";
          await channelRepository.updateCrawlJobStatus(crawlJobId, "FAILED", { errorMessage: errMsg });

          emitChannelCrawlFailed(userId, { crawlJobId, error: errMsg, timestamp: new Date() });

          return { crawlJobId, success: false, error: errMsg };
        }
      },

      // Script extraction processor
      async (job: Job<ScriptExtractionJobData>): Promise<ChannelJobResult> => {
        const { crawlJobId, userId, videoIds } = job.data;
        const startTime = Date.now();

        try {
          const videos = await channelRepository.getVideosByIds(videoIds);

          for (let i = 0; i < videos.length; i++) {
            const video = videos[i]!;

            emitChannelExtractProgress(userId, {
              crawlJobId,
              processed: i,
              total: videos.length,
              currentVideoId: video.id,
              message: `Đang xử lý video ${i + 1}/${videos.length}...`,
              timestamp: new Date(),
            });

            try {
              const result = await geminiExtractor.extractScript(
                video.videoUrl,
                video.id,
                video.description ?? undefined,
              );

              await channelRepository.saveScriptResult({
                videoId: video.id,
                crawlJobId,
                scriptText: result.scriptText,
                scriptLines: result.scriptLines,
                sourceMethod: result.sourceMethod,
              });

              console.log(`[ChannelService] ✅ Extracted script for video ${video.id} (${result.sourceMethod})`);
            } catch (videoErr) {
              const errMsg = videoErr instanceof Error ? videoErr.message : "Unknown";
              console.error(`[ChannelService] ❌ Failed video ${video.id}: ${errMsg}`);

              // Save fallback
              await channelRepository.saveScriptResult({
                videoId: video.id,
                crawlJobId,
                scriptText: video.description ?? "(Không có nội dung)",
                scriptLines: [video.description ?? "(Không có nội dung)"],
                sourceMethod: "DESCRIPTION_FALLBACK",
              });
            }
          }

          const duration = Date.now() - startTime;

          emitChannelExtractCompleted(userId, {
            crawlJobId,
            totalExtracted: videos.length,
            duration,
            message: `Hoàn thành trích xuất ${videos.length} kịch bản!`,
            timestamp: new Date(),
          });

          return { crawlJobId, success: true };
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Unknown error";
          emitChannelExtractFailed(userId, { crawlJobId, error: errMsg, timestamp: new Date() });
          return { crawlJobId, success: false, error: errMsg };
        }
      },
    );

    this.isProcessorRegistered = true;
    console.log("[ChannelService] Processors registered");
  }
}

export const channelService = new ChannelService();
