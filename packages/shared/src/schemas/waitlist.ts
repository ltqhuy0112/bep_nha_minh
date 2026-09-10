import { z } from "zod";
import { normalizePhone } from "../utils/phone";

const phonePattern = /^(?:\+?84|0)(?:\d[\s.-]?){8,10}$/;
const htmlPattern = /<[^>]*>/;

const safeText = (
  field: string,
  max: number,
  options: { requiredMessage?: string; lowercase?: boolean } = {}
) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z
      .string()
      .trim()
      .refine((value) => !options.requiredMessage || value.length > 0, {
        message: options.requiredMessage
      })
      .max(max, `${field} quá dài.`)
      .refine((value) => !htmlPattern.test(value), {
        message: "Vui lòng không nhập HTML."
      })
      .transform((value) => (options.lowercase ? value.toLowerCase() : value))
  );

export const waitlistSchema = z
  .object({
    name: safeText("Tên", 120, { requiredMessage: "Vui lòng nhập tên." }),
    phone: safeText("Số điện thoại", 30).transform((value) =>
      value ? normalizePhone(value) : ""
    ),
    email: safeText("Email", 255, { lowercase: true }).refine(
      (value) => value === "" || z.email().safeParse(value).success,
      {
        message: "Email chưa đúng định dạng."
      }
    ),
    district: safeText("Khu vực", 120, {
      requiredMessage: "Vui lòng nhập khu vực/quận."
    }),
    preferredMeal: safeText("Lựa chọn", 80),
    source: safeText("Nguồn", 80).transform((value) => value || "website")
  })
  .superRefine((value, context) => {
    const hasPhone = value.phone.length > 0;
    const hasEmail = value.email.length > 0;

    if (!hasPhone && !hasEmail) {
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Vui lòng nhập số điện thoại hoặc email."
      });
    }

    if (hasPhone && !phonePattern.test(value.phone)) {
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Số điện thoại chưa đúng định dạng."
      });
    }
  });

export type WaitlistInput = z.infer<typeof waitlistSchema>;
