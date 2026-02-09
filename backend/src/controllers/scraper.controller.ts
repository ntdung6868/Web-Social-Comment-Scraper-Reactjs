// ===========================================
// Scraper Controller
// ===========================================
// HTTP request handlers for scraping endpoints

import type { Request, Response } from "express";
import ExcelJS from "exceljs";
import { scraperService } from "../services/scraper.service.js";
import { asyncHandler } from "../middlewares/error.middleware.js";
import { sendSuccess, sendNoContent } from "../utils/response.js";
import type { ScrapeRequestInput, HistoryListQueryInput } from "../validators/scraper.validators.js";

// ===========================================
// Scraper Controller
// ===========================================

export const scraperController = {
  // ===========================================
  // Scraping Operations
  // ===========================================

  /**
   * POST /scraper/start
   * Start a new scrape job
   */
  startScrape: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const data = req.body as ScrapeRequestInput;
    const result = await scraperService.startScrape(req.user.userId, data);

    res.status(202).json({
      success: true,
      data: result,
      message: "Scrape job started",
    });
  }),

  /**
   * GET /scraper/status/:id
   * Get scrape job status
   */
  getStatus: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const historyId = parseInt(req.params.id!, 10);
    if (isNaN(historyId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Invalid history ID" },
      });
      return;
    }

    const status = await scraperService.getJobStatus(historyId, req.user.userId);
    sendSuccess(res, status);
  }),

  // ===========================================
  // History Operations
  // ===========================================

  /**
   * GET /scraper/history
   * Get paginated scrape history
   */
  getHistory: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const query = req.query as unknown as HistoryListQueryInput;
    const history = await scraperService.getHistory(req.user.userId, query);

    sendSuccess(res, history);
  }),

  /**
   * GET /scraper/history/:id
   * Get history detail with comments
   */
  getHistoryDetail: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const historyId = parseInt(req.params.id!, 10);
    if (isNaN(historyId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Invalid history ID" },
      });
      return;
    }

    const detail = await scraperService.getHistoryDetail(historyId, req.user.userId);
    sendSuccess(res, detail);
  }),

  /**
   * DELETE /scraper/history/:id
   * Delete scrape history
   */
  deleteHistory: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const historyId = parseInt(req.params.id!, 10);
    if (isNaN(historyId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Invalid history ID" },
      });
      return;
    }

    await scraperService.deleteHistory(historyId, req.user.userId);
    sendNoContent(res);
  }),

  // ===========================================
  // Dashboard
  // ===========================================

  /**
   * GET /scraper/dashboard
   * Get dashboard statistics
   */
  getDashboard: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const [stats, recentScrapes] = await Promise.all([
      scraperService.getDashboardStats(req.user.userId),
      scraperService.getRecentScrapes(req.user.userId, 5),
    ]);

    sendSuccess(res, {
      stats,
      recentScrapes,
    });
  }),

  // ===========================================
  // Export Operations
  // ===========================================

  /**
   * GET /scraper/export/:id
   * Export comments in various formats
   */
  exportComments: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const historyId = parseInt(req.params.id!, 10);
    if (isNaN(historyId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Invalid history ID" },
      });
      return;
    }

    const format = (req.query.format as string) || "xlsx";
    if (!["xlsx", "csv", "json"].includes(format)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Format must be xlsx, csv, or json" },
      });
      return;
    }

    const { history, comments } = await scraperService.getCommentsForExport(historyId, req.user.userId);

    const filename = `comments_${historyId}_${Date.now()}`;

    switch (format) {
      case "json":
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}.json"`);
        res.json({
          url: history.url,
          platform: history.platform,
          exportedAt: new Date().toISOString(),
          totalComments: comments.length,
          comments,
        });
        break;

      case "csv":
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);

        // CSV header
        let csv = "Username,Content,Timestamp,Likes\n";

        // CSV rows
        for (const comment of comments) {
          const escapedContent = `"${(comment.content || "").replace(/"/g, '""')}"`;
          csv += `${comment.username},${escapedContent},${comment.timestamp || ""},${comment.likes}\n`;
        }

        res.send(csv);
        break;

      case "xlsx":
      default:
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Comments");

        // Add metadata
        worksheet.addRow(["URL", history.url]);
        worksheet.addRow(["Platform", history.platform]);
        worksheet.addRow(["Exported At", new Date().toISOString()]);
        worksheet.addRow(["Total Comments", comments.length]);
        worksheet.addRow([]);

        // Add header row
        const headerRow = worksheet.addRow(["Username", "Content", "Timestamp", "Likes"]);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };

        // Add data rows
        for (const comment of comments) {
          worksheet.addRow([comment.username, comment.content, comment.timestamp || "", comment.likes]);
        }

        // Auto-fit columns
        worksheet.columns.forEach((column) => {
          let maxLength = 10;
          column.eachCell?.({ includeEmpty: true }, (cell) => {
            const cellLength = cell.value?.toString().length || 0;
            if (cellLength > maxLength) {
              maxLength = Math.min(cellLength, 50);
            }
          });
          column.width = maxLength + 2;
        });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
        break;
    }
  }),
};
