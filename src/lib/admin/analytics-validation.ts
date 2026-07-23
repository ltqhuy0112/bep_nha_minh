import { z } from "zod";

export const analyticsRangeValues = ["1d", "3d", "7d"] as const;

export const orderAnalyticsQuerySchema = z
  .object({
    range: z.enum(analyticsRangeValues).optional(),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional()
  })
  .refine((input) => !(input.range && (input.dateFrom || input.dateTo)), {
    message: "range and custom dates are mutually exclusive.",
    path: ["range"]
  })
  .refine((input) => input.range || (!input.dateFrom && !input.dateTo) || (input.dateFrom && input.dateTo), {
    message: "Custom range requires dateFrom and dateTo.",
    path: ["dateFrom"]
  })
  .refine((input) => !input.dateFrom || !input.dateTo || input.dateFrom <= input.dateTo, {
    message: "dateFrom must be before or equal to dateTo.",
    path: ["dateFrom"]
  })
  .refine(
    (input) => {
      if (!input.dateFrom || !input.dateTo) {
        return true;
      }

      const from = Date.parse(`${input.dateFrom}T00:00:00.000Z`);
      const to = Date.parse(`${input.dateTo}T00:00:00.000Z`);
      const dayCount = Math.floor((to - from) / 86_400_000) + 1;

      return dayCount <= 366;
    },
    {
      message: "Custom range must be 366 days or fewer.",
      path: ["dateTo"]
    }
  );

export function analyticsFieldErrors(error: z.ZodError) {
  const details: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!details[field]) {
      details[field] = issue.message;
    }
  }

  return details;
}
