import { z } from "zod";

export const healthStatusSchema = z.object({
  status: z.literal("ok")
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const liveHealth: HealthStatus = { status: "ok" };
