import { z } from "zod";
import { isOrderStatus, orderStatuses } from "@/lib/order-status";

export const uuidSchema = z.string().uuid();

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isOrderStatus(value), {
      message: "Invalid order status."
    }),
  search: z.string().trim().max(120).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  customerId: uuidSchema.optional(),
  sortBy: z
    .enum([
      "createdAt",
      "deliveryDate",
      "orderCode",
      "status",
      "totalAmount"
    ])
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc")
});

export const approveOrderSchema = z.object({
  internalNote: z.string().trim().max(1000).optional()
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(3).max(1000)
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(orderStatuses),
  reason: z.string().trim().max(1000).optional()
});

export function zodFieldErrors(error: z.ZodError) {
  const details: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!details[field]) {
      details[field] = issue.message;
    }
  }

  return details;
}
