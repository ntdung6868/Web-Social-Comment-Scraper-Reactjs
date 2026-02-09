// ===========================================
// Scraper Routes
// ===========================================
// Protected routes for scraping operations

import { Router } from "express";
import { scraperController } from "../controllers/scraper.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { scrapeLimiter } from "../middlewares/rateLimit.middleware.js";
import { zodValidate } from "../validators/zod.middleware.js";
import { scrapeRequestSchema, historyListQuerySchema } from "../validators/scraper.validators.js";

const router = Router();

// All scraper routes require authentication
router.use(authenticate);

// ===========================================
// Scraping Operations
// ===========================================

/**
 * POST /api/scraper/start
 * Start a new scrape job
 */
router.post("/start", scrapeLimiter, zodValidate(scrapeRequestSchema), scraperController.startScrape);

/**
 * GET /api/scraper/status/:id
 * Get scrape job status
 */
router.get("/status/:id", scraperController.getStatus);

// ===========================================
// Dashboard
// ===========================================

/**
 * GET /api/scraper/dashboard
 * Get dashboard statistics and recent scrapes
 */
router.get("/dashboard", scraperController.getDashboard);

// ===========================================
// History Operations
// ===========================================

/**
 * GET /api/scraper/history
 * Get paginated scrape history
 */
router.get("/history", zodValidate(historyListQuerySchema, "query"), scraperController.getHistory);

/**
 * GET /api/scraper/history/:id
 * Get history detail with comments
 */
router.get("/history/:id", scraperController.getHistoryDetail);

/**
 * DELETE /api/scraper/history/:id
 * Delete scrape history
 */
router.delete("/history/:id", scraperController.deleteHistory);

// ===========================================
// Export Operations
// ===========================================

/**
 * GET /api/scraper/export/:id
 * Export comments in various formats (xlsx, csv, json)
 * Query param: format=xlsx|csv|json
 */
router.get("/export/:id", scraperController.exportComments);

export default router;
