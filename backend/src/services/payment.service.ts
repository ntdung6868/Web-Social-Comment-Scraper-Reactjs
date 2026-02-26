// ===========================================
// Payment Service (SePay VietQR)
// ===========================================
// Generates SePay VietQR codes for payment and processes incoming webhooks
// to automatically upgrade user subscription plans on confirmed transfers.

import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { createError } from "../middlewares/error.middleware.js";
import { paymentRepository } from "../repositories/payment.repository.js";
import { getPlanPricing } from "../utils/settings.js";
import { emitPaymentSuccess } from "../lib/socket.js";

// 1 USD = 25,000 VND (fixed conversion)
const USD_TO_VND = 25_000;

// Subscription duration per plan (days)
const PLAN_DURATIONS: Record<string, number> = {
  PERSONAL: 3,
  PREMIUM: 30,
};

// ===========================================
// Payment Service Class
// ===========================================

export class PaymentService {
  /**
   * Generate a unique 6-digit order code that doesn't already exist in the DB.
   */
  private async generateUniqueOrderCode(): Promise<number> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = Math.floor(100_000 + Math.random() * 900_000);
      const existing = await paymentRepository.findByOrderCode(code);
      if (!existing) return code;
    }
    throw createError.internal("Failed to generate a unique order code. Please try again.");
  }

  /**
   * POST /payments/create-link
   * Generates a SePay VietQR image URL for the chosen plan.
   */
  async createPaymentLink(
    userId: string,
    planType: "PERSONAL" | "PREMIUM",
  ): Promise<{
    orderCode: number;
    qrUrl: string;
    amount: number;
    description: string;
  }> {
    if (!env.sepay.bankAcc || !env.sepay.bankName) {
      throw createError.serviceUnavailable(
        "Payment gateway is not configured. Please contact the administrator.",
      );
    }

    // Get plan price from GlobalSettings (in USD, dynamic)
    const pricing = await getPlanPricing();
    const usdPrice = (pricing as Record<string, { price: number }>)[planType]?.price ?? 0;
    if (usdPrice <= 0) {
      throw createError.badRequest(`No price configured for plan ${planType}`, "INVALID_PLAN_PRICE");
    }
    const amountVND = Math.round(usdPrice * USD_TO_VND);

    // Generate unique orderCode; build VIP reference string used in bank transfer description
    const orderCode = await this.generateUniqueOrderCode();
    const description = `VIP${orderCode}`;

    // Construct SePay QR image URL — returned directly to frontend as <img src>
    const qrUrl = `https://qr.sepay.vn/img?acc=${env.sepay.bankAcc}&bank=${env.sepay.bankName}&amount=${amountVND}&des=${description}`;

    // Create PENDING order in DB (checkoutUrl reused to store QR URL for reference)
    await paymentRepository.createOrder({
      orderCode,
      userId,
      planType,
      amount: amountVND,
      description,
      checkoutUrl: qrUrl,
    });

    return { orderCode, qrUrl, amount: amountVND, description };
  }

  /**
   * POST /payments/sepay-webhook
   * Receives SePay transfer notifications and upgrades the user plan.
   * Auth is verified by the controller via `Authorization: Apikey TOKEN` header.
   * Idempotent — safe to call multiple times for the same order.
   */
  async handleWebhook(body: unknown): Promise<{ success: boolean }> {
    const { amountIn, transactionContent } = body as {
      amountIn: number | string;
      transactionContent: string;
    };

    if (!transactionContent) return { success: true };

    // Extract VIP order code from the bank transfer description (e.g. "VIP123456")
    const match = String(transactionContent).match(/VIP(\d+)/i);
    if (!match) return { success: true };

    const orderCode = Number(match[1]);
    const order = await paymentRepository.findByOrderCode(orderCode);

    if (!order) {
      console.warn(`[Payment] Webhook: order ${orderCode} not found in DB`);
      return { success: true };
    }

    if (order.status === "PAID") {
      console.log(`[Payment] Webhook: order ${orderCode} already processed (idempotent)`);
      return { success: true };
    }

    // Verify transferred amount is sufficient
    if (Number(amountIn) < order.amount) {
      console.warn(
        `[Payment] Webhook: insufficient amount for order ${orderCode}. Expected ${order.amount}, got ${amountIn}`,
      );
      return { success: true };
    }

    // Mark order PAID
    await paymentRepository.updateOrder(orderCode, { status: "PAID", paidAt: new Date() });

    // Upgrade user plan
    const durationDays = PLAN_DURATIONS[order.planType] ?? 30;
    const subscriptionStart = new Date();
    const subscriptionEnd = new Date(Date.now() + durationDays * 86_400_000);

    await prisma.user.update({
      where: { id: order.userId },
      data: {
        planType: order.planType,
        planStatus: "ACTIVE",
        subscriptionStart,
        subscriptionEnd,
      },
    });

    console.log(
      `[Payment] ✅ Order ${orderCode}: user ${order.userId} upgraded to ${order.planType} until ${subscriptionEnd.toISOString()}`,
    );

    // Notify user in real-time via Socket.io
    emitPaymentSuccess(order.userId, {
      orderCode,
      planType: order.planType,
      planExpiresAt: subscriptionEnd.toISOString(),
    });

    return { success: true };
  }

  /**
   * GET /payments/order/:orderCode
   * Returns the order status for a given user (ownership check).
   */
  async getOrderStatus(orderCode: number, userId: string) {
    const order = await paymentRepository.findByOrderCode(orderCode);
    if (!order || order.userId !== userId) {
      throw createError.notFound("Order not found");
    }
    return order;
  }

  /**
   * GET /payments/history
   * Returns the last 20 orders for a user.
   */
  async getUserOrders(userId: string) {
    return paymentRepository.getUserOrders(userId);
  }
}

export const paymentService = new PaymentService();
