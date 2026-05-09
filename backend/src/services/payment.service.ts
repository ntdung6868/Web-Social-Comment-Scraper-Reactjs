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
import { logger } from "../lib/logger.js";

const log = logger.child({ module: "payment" });

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
    bankName: string;
    bankAcc: string;
    accountName: string;
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

    // Generate unique orderCode; build SEVQR reference string used in bank transfer description
    // SePay + VietinBank requires the transfer content to start with "SEVQR"
    const orderCode = await this.generateUniqueOrderCode();
    const description = `SEVQR${orderCode}`;

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

    return {
      orderCode,
      qrUrl,
      amount: amountVND,
      description,
      bankName: env.sepay.bankName,
      bankAcc: env.sepay.bankAcc,
      accountName: env.sepay.accountName,
    };
  }

  /**
   * POST /payments/sepay-webhook
   * Receives SePay transfer notifications and upgrades the user plan.
   * Auth is verified by the controller via `Authorization: Apikey TOKEN` header.
   * Idempotent — safe to call multiple times for the same order.
   */
  async handleWebhook(body: unknown): Promise<{ success: boolean }> {
    const { transferAmount, content } = body as {
      transferAmount: number | string;
      content: string;
    };

    if (!content) {
      log.warn("Webhook with empty content, ignored");
      return { success: true };
    }

    // Extract SEVQR order code from the bank transfer description (e.g. "SEVQR123456")
    const match = String(content).match(/SEVQR(\d+)/i);
    if (!match) {
      log.warn({ content }, "Webhook content has no SEVQR code");
      return { success: true };
    }

    const orderCode = Number(match[1]);
    const order = await paymentRepository.findByOrderCode(orderCode);

    if (!order) {
      log.warn({ orderCode }, "Webhook for unknown order");
      return { success: true };
    }

    if (order.status === "PAID") {
      log.info({ orderCode }, "Webhook for already-paid order (idempotent reject)");
      return { success: true };
    }

    log.info(
      { orderCode, status: order.status, amount: order.amount, planType: order.planType, userId: order.userId },
      "Webhook matched pending order",
    );

    // Verify transferred amount is sufficient. We still return 200 to SePay
    // (their docs require it to stop retries) but mark the order as
    // UNDERPAID and log loudly so operators can refund or top up manually —
    // previously this case silently looked like a healthy webhook.
    if (Number(transferAmount) < order.amount) {
      log.error(
        { orderCode, transferAmount, expected: order.amount, userId: order.userId, planType: order.planType },
        "UNDERPAY detected — order marked UNDERPAID for manual review",
      );
      await paymentRepository
        .updateOrder(orderCode, { status: "UNDERPAID", paidAt: new Date() })
        .catch((e) => log.warn({ orderCode, err: e }, "Could not mark order UNDERPAID"));
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

    log.info(
      { orderCode, userId: order.userId, planType: order.planType, subscriptionEnd: subscriptionEnd.toISOString() },
      "Plan upgraded successfully",
    );

    // Best-effort confirmation email — never fail the webhook over a
    // missing email address or a Resend outage.
    try {
      const buyer = await prisma.user.findUnique({
        where: { id: order.userId },
        select: { email: true },
      });
      if (buyer?.email) {
        const { sendPaymentSuccessEmail } = await import("../lib/email.js");
        await sendPaymentSuccessEmail(buyer.email, {
          planType: order.planType,
          amount: order.amount,
          orderCode,
          expiresAt: subscriptionEnd,
        });
      }
    } catch (e) {
      log.warn({ orderCode, err: e }, "Could not send payment confirmation email");
    }

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
