// ===========================================
// Payment Service
// ===========================================
// PayOS VietQR integration — create checkout links, handle webhooks,
// and auto-upgrade user plans on successful payment.

import { PayOS } from "@payos/node";
import type { Webhook } from "@payos/node";
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
// PayOS SDK Factory
// ===========================================
function getPayOSClient(): PayOS {
  return new PayOS({ clientId: env.payos.clientId, apiKey: env.payos.apiKey, checksumKey: env.payos.checksumKey });
}

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
   * Creates a PayOS checkout link for the chosen plan.
   */
  async createPaymentLink(
    userId: string,
    planType: "PERSONAL" | "PREMIUM",
  ): Promise<{
    orderCode: number;
    checkoutUrl: string;
    qrCode: string;
    amount: number;
    description: string;
  }> {
    if (!env.payos.clientId || !env.payos.apiKey || !env.payos.checksumKey) {
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

    // Generate unique orderCode
    const orderCode = await this.generateUniqueOrderCode();
    const description = `${planType} Plan`;

    // Create PENDING order in DB
    await paymentRepository.createOrder({ orderCode, userId, planType, amount: amountVND, description });

    // Build PayOS payload
    const returnUrl = `${env.frontend.url}/pricing?orderCode=${orderCode}`;
    const cancelUrl = `${env.frontend.url}/pricing`;

    const payos = getPayOSClient();
    let payosResponse: Awaited<ReturnType<typeof payos.paymentRequests.create>>;

    try {
      payosResponse = await payos.paymentRequests.create({
        orderCode,
        amount: amountVND,
        description,
        items: [{ name: `${planType} Plan`, quantity: 1, price: amountVND }],
        returnUrl,
        cancelUrl,
      });
    } catch (err) {
      console.error("[Payment] PayOS createPaymentLink error:", err);
      throw createError.internal("Failed to create payment link. Please try again.");
    }

    // Persist checkoutUrl for later reference
    await paymentRepository.updateOrder(orderCode, { checkoutUrl: payosResponse.checkoutUrl });

    return {
      orderCode,
      checkoutUrl: payosResponse.checkoutUrl,
      qrCode: payosResponse.qrCode,
      amount: amountVND,
      description,
    };
  }

  /**
   * POST /payments/webhook
   * Verifies PayOS signature, marks order PAID, upgrades user plan.
   * Idempotent — safe to call multiple times for the same order.
   */
  async handleWebhook(body: unknown): Promise<{ success: boolean }> {
    const payos = getPayOSClient();

    let webhookData: Awaited<ReturnType<typeof payos.webhooks.verify>>;
    try {
      webhookData = await payos.webhooks.verify(body as Webhook);
    } catch (err) {
      console.error("[Payment] Webhook signature verification failed:", err);
      throw createError.badRequest("Invalid webhook signature", "INVALID_WEBHOOK_SIGNATURE");
    }

    // PayOS sends test webhooks with code "00" but orderCode 0 — skip those
    if (!webhookData.orderCode) {
      return { success: true };
    }

    // code "00" on the outer body = PAID; non-"00" outer code = cancel/timeout
    const outerCode = (body as Webhook).code;
    if (outerCode !== "00") {
      console.log(`[Payment] Webhook non-payment event: code=${outerCode}, order=${webhookData.orderCode}`);
      return { success: true };
    }

    const orderCode = Number(webhookData.orderCode);
    const order = await paymentRepository.findByOrderCode(orderCode);

    if (!order) {
      console.warn(`[Payment] Webhook: order ${orderCode} not found in DB`);
      return { success: true }; // Don't error — PayOS may retry
    }

    if (order.status === "PAID") {
      console.log(`[Payment] Webhook: order ${orderCode} already processed (idempotent)`);
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
