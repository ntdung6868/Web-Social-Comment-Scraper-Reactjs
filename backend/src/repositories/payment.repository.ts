// ===========================================
// Payment Repository
// ===========================================
// Prisma queries for the Order collection

import { prisma } from "../config/database.js";
import type { Order } from "@prisma/client";

interface CreateOrderData {
  orderCode: number;
  userId: string;
  planType: string;
  amount: number;
  description: string;
}

export class PaymentRepository {
  async createOrder(data: CreateOrderData): Promise<Order> {
    return prisma.order.create({
      data: {
        orderCode: data.orderCode,
        userId: data.userId,
        planType: data.planType,
        amount: data.amount,
        description: data.description,
        status: "PENDING",
      },
    });
  }

  async findByOrderCode(orderCode: number): Promise<Order | null> {
    return prisma.order.findUnique({ where: { orderCode } });
  }

  async updateOrder(orderCode: number, data: Partial<Order>): Promise<Order> {
    return prisma.order.update({ where: { orderCode }, data });
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }
}

export const paymentRepository = new PaymentRepository();
