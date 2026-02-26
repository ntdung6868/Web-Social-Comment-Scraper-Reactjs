// ===========================================
// Payment Controller
// ===========================================

import type { Request, Response } from "express";
import { paymentService } from "../services/payment.service.js";
import { asyncHandler } from "../middlewares/error.middleware.js";
import { sendSuccess, sendCreated } from "../utils/response.js";
import type { CreatePaymentLinkInput } from "../validators/payment.validators.js";

export const paymentController = {
  /**
   * POST /api/v1/payments/create-link
   * Creates a PayOS checkout link for the chosen plan.
   * Requires authentication.
   */
  createLink: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    const { planType } = req.body as CreatePaymentLinkInput;
    const result = await paymentService.createPaymentLink(req.user.userId, planType);

    sendCreated(res, result, "Payment link created");
  }),

  /**
   * POST /api/v1/payments/webhook
   * PayOS webhook — no authentication (PayOS calls this externally).
   * Verifies checksum internally via SDK.
   */
  webhook: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await paymentService.handleWebhook(req.body);
    res.json(result);
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
