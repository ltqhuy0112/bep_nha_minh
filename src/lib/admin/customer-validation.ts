import { z } from "zod";

export const customerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional()
});

export function customerFieldErrors(error: z.ZodError) {
  const details: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!details[field]) {
      details[field] = issue.message;
    }
  }

  return details;
}
