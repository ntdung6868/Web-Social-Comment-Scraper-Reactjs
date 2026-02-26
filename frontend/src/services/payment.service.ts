import { apiRequest } from "./api";
import type { ApiResponse, Order } from "@/types";

export interface CreatePaymentLinkResponse {
  orderCode: number;
  qrUrl: string;
  amount: number;
  description: string;
}

export const paymentService = {
  createPaymentLink: (planType: "PERSONAL" | "PREMIUM") =>
    apiRequest.post<ApiResponse<CreatePaymentLinkResponse>>("/payments/create-link", { planType }),

  getOrderStatus: (orderCode: number) =>
    apiRequest.get<ApiResponse<Order>>(`/payments/order/${orderCode}`),

  getHistory: () =>
    apiRequest.get<ApiResponse<{ orders: Order[] }>>("/payments/history"),
};
