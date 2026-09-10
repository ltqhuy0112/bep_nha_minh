import { z } from "zod";

const locale = z.enum(["vi", "en"]);
const version = z.number().int().nonnegative().max(2147483646);
const date = z.iso.date().refine((value) => value >= "2000-01-01" && value <= "9999-12-31");
export const cartCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("initialize"), locale }),
  z.strictObject({ action: z.literal("set-item"), locale, expectedVersion: version,
    source: z.enum(["guest", "account"]).optional(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160), quantity: z.number().int().min(0).max(2147483647) }),
  z.strictObject({ action: z.literal("set-slot"), locale, expectedVersion: version, businessDate: date, slotKey: z.string().min(1).max(80) }),
  z.strictObject({ action: z.literal("merge"), locale, expectedVersion: version, guestVersion: version,
    slotSource: z.enum(["guest", "account"]).optional() }),
]);
export type CartCommand = z.infer<typeof cartCommandSchema>;
