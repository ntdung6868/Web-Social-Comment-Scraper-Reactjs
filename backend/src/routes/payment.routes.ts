// ===========================================
// Payment Routes
// ===========================================

import { Router } from "express";
import { paymentController } from "../controllers/payment.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { paymentLimiter } from "../middlewares/rateLimit.middleware.js";
import { zodValidate } from "../validators/zod.middleware.js";
import { createPaymentLinkSchema } from "../validators/payment.validators.js";

const router = Router();

/**
 * POST /api/v1/payments/create-link
 * Generate a SePay VietQR URL for the selected plan.
 */
router.post(
  "/create-link",
  authenticate,
  paymentLimiter,
  zodValidate(createPaymentLinkSchema),
  paymentController.createLink,
);

/**
 * POST /api/v1/payments/sepay-webhook
 * SePay sends transfer notifications here.
 * No user auth — verified via Authorization: Apikey header inside the handler.
 */
router.post("/sepay-webhook", paymentController.webhook);

/**
 * GET /api/v1/payments/order/:orderCode
 * Poll order payment status (used when Socket.io is unavailable).
 */
router.get("/order/:orderCode", authenticate, paymentController.getOrderStatus);

/**
 * GET /api/v1/payments/history
 * Get payment history for the authenticated user.
 */
router.get("/history", authenticate, paymentController.getHistory);

export default router;
