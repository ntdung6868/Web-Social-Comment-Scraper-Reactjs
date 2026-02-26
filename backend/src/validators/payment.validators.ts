// ===========================================
// Payment Validation Schemas
// ===========================================

import { z } from "zod";

export const createPaymentLinkSchema = z.object({
  planType: z.enum(["PERSONAL", "PREMIUM"], {
    errorMap: () => ({ message: "planType must be PERSONAL or PREMIUM" }),
  }),
});

export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;
