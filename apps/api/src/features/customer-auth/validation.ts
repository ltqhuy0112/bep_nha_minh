import { z } from "zod";

const email = z.string().trim().max(255).email().transform((value) => value.toLowerCase());
const password = z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72);
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const locale = z.enum(["vi", "en"]).default("vi");
export const authSchemas = {
  register: z.strictObject({ email, password, fullName: z.string().trim().min(1).max(120), locale }),
  login: z.strictObject({ email, password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72) }),
  "forgot-password": z.strictObject({ email, locale }),
  "reset-password": z.strictObject({ token, password }),
  "verify-email": z.strictObject({ token }),
  "resend-verification": z.strictObject({ locale }),
  logout: z.strictObject({}),
  "logout-all": z.strictObject({})
};
