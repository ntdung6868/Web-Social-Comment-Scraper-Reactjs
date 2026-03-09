// ===========================================
// Channel Routes
// ===========================================

import { Router } from "express";
import { channelController } from "../controllers/channel.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { zodValidate } from "../validators/zod.middleware.js";
import { channelCrawlSchema, scriptExtractionSchema } from "../validators/channel.validators.js";

const router = Router();

// All channel routes require authentication
router.use(authenticate);

// POST /api/v1/channel/start — Phase 1: start channel crawl
router.post("/start", zodValidate(channelCrawlSchema), channelController.startCrawl);

// GET /api/v1/channel/history — paginated history (must come before /:id routes)
router.get("/history", channelController.getHistory);

// GET /api/v1/channel/:id/status
router.get("/:id/status", channelController.getStatus);

// GET /api/v1/channel/:id/videos
router.get("/:id/videos", channelController.getVideos);

// POST /api/v1/channel/:id/extract — Phase 2: start script extraction
router.post("/:id/extract", zodValidate(scriptExtractionSchema), channelController.startExtract);

// GET /api/v1/channel/:id/scripts
router.get("/:id/scripts", channelController.getScripts);

// GET /api/v1/channel/:id/export?format=xlsx|csv|json
router.get("/:id/export", channelController.exportScripts);

// DELETE /api/v1/channel/:id
router.delete("/:id", channelController.deleteJob);

export default router;
