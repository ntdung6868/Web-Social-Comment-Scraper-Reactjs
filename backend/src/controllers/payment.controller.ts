// ===========================================
// Payment Controller
// ===========================================

import type { Request, Response } from "express";
import { paymentService } from "../services/payment.service.js";
import { asyncHandler } from "../middlewares/error.middleware.js";
import { sendSuccess, sendCreated } from "../utils/response.js";
import { env } from "../config/env.js";
import type { CreatePaymentLinkInput } from "../validators/payment.validators.js";

export const paymentController = {
  /**
   * POST /api/v1/payments/create-link
   * Generates a SePay VietQR URL for the chosen plan.
   * Requires authentication.
   */
  createLink: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    const { planType } = req.body as CreatePaymentLinkInput;
    const result = await paymentService.createPaymentLink(req.user.userId, planType);

    sendCreated(res, result, "Payment QR generated");
  }),

  /**
   * POST /api/v1/payments/sepay-webhook
   * SePay sends transfer notifications here — no user auth.
   * Security: verified via `Authorization: Apikey TOKEN` header.
   */
  webhook: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log("🔔 [WEBHOOK RUNG] Headers:", JSON.stringify(req.headers));
    console.log("🔔 [WEBHOOK RUNG] Body:", JSON.stringify(req.body));

    if (req.headers.authorization !== `Apikey ${env.sepay.webhookToken}`) {
      console.log("🔑 Auth Nhận được:", req.headers.authorization);
      console.log("🔑 Auth Kì vọng: Apikey", process.env.SEPAY_WEBHOOK_TOKEN);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await paymentService.handleWebhook(req.body);
    res.status(200).json({ success: true });
  }),

  /**
   * GET /api/v1/payments/order/:orderCode
   * Poll order status (fallback when Socket.io is unavailable).
   * Requires authentication.
   */
  getOrderStatus: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    const orderCode = Number(req.params.orderCode);
    if (isNaN(orderCode)) {
      res.status(400).json({ success: false, error: { code: "INVALID_INPUT", message: "Invalid order code" } });
      return;
    }

    const order = await paymentService.getOrderStatus(orderCode, req.user.userId);
    sendSuccess(res, order);
  }),

  /**
   * GET /api/v1/payments/history
   * Returns payment history for the authenticated user.
   */
  getHistory: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    const orders = await paymentService.getUserOrders(req.user.userId);
    sendSuccess(res, { orders });
  }),
};
