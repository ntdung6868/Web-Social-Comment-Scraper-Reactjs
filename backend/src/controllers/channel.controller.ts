// ===========================================
// Channel Controller
// ===========================================

import type { Request, Response } from "express";
import { channelService } from "../services/channel.service.js";
import { asyncHandler } from "../middlewares/error.middleware.js";
import { sendSuccess, sendNoContent } from "../utils/response.js";
import type { ChannelCrawlInput, ScriptExtractionInput, ChannelHistoryQueryInput } from "../validators/channel.validators.js";

function requireUser(req: Request, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    return false;
  }
  return true;
}

export const channelController = {
  /**
   * POST /channel/start
   */
  startCrawl: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!requireUser(req, res)) return;
    const data = req.body as ChannelCrawlInput;
    const result = await channelService.startChannelCrawl(req.user!.userId, data);
    res.status(202).json({ success: true, data: result, message: "Channel crawl started" });
  }),

  /**
   * GET /channel/:id/status
   */
  getStatus: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!requireUser(req, res)) return;
    const crawlJob = await channelService.getChannelCrawlStatus(req.params.id!, req.user!.userId);
    sendSuccess(res, crawlJob);
  }),

  /**
   * GET /channel/:id/videos
   */
  getVideos: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!requireUser(req, res)) return;
    const videos = await channelService.getFilteredVideos(req.params.id!, req.user!.userId);
    sendSuccess(res, videos);
  }),

  /**
   * POST /channel/:id/extract
   */
  startExtract: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!requireUser(req, res)) return;
    const data = req.body as ScriptExtractionInput;
    const result = await channelService.startScriptExtraction(req.user!.userId, {
      crawlJobId: req.params.id!,
      videoIds: data.videoIds,
    });
    res.status(202).json({ success: true, data: result, message: "Script extraction started" });
  }),

  /**
   * GET /channel/:id/scripts
   */
  getScripts: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!requireUser(req, res)) return;
    const scripts = await channelService.getScriptResults(req.params.id!, req.user!.userId);
    sendSuccess(res, scripts);
  }),

  /**
   * GET /channel/history
   */
  getHistory: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!requireUser(req, res)) return;
    const query = req.query as unknown as ChannelHistoryQueryInput;
    const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(query.limit ?? "10"), 10) || 10));
    const history = await channelService.getCrawlHistory(req.user!.userId, page, limit);
    sendSuccess(res, history);
  }),

  /**
   * DELETE /channel/:id
   */
  deleteJob: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!requireUser(req, res)) return;
    await channelService.deleteCrawlJob(req.params.id!, req.user!.userId);
    sendNoContent(res);
  }),

  /**
   * GET /channel/:id/export?format=xlsx|csv|json
   */
  exportScripts: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!requireUser(req, res)) return;

    const format = (req.query.format as string) || "xlsx";
    if (!["xlsx", "csv", "json"].includes(format)) {
      res.status(400).json({ success: false, error: { code: "INVALID_INPUT", message: "Format must be xlsx, csv, or json" } });
      return;
    }

    const result = await channelService.exportScripts(
      req.params.id!,
      req.user!.userId,
      format as "xlsx" | "csv" | "json",
    );

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `scripts-tiktok-${timestamp}`;

    if (result.type === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.json"`);
      res.json(result.data);
    } else if (result.type === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
      res.send(result.data);
    } else {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
      await result.workbook.xlsx.write(res);
      res.end();
    }
  }),
};
