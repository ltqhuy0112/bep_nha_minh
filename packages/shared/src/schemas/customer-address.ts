import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
export const customerAddressSchema = z.strictObject({
  recipientName: text(120),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,23}$/).refine((value) => {
    const digits = value.replace(/\D/g, "").length;
    return digits >= 7 && digits <= 15;
  }),
  addressLine: text(500),
  provinceCode: z.string().regex(/^[0-9]{2}$/),
  wardCode: z.string().regex(/^[0-9]{5}$/),
  isDefault: z.boolean(),
});
export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;
export type CustomerAddress = Omit<CustomerAddressInput, "provinceCode" | "wardCode"> & {
  id: string; createdAt: string; updatedAt: string;
  provinceCode: string | null; wardCode: string | null; locationDatasetId: string | null;
  city: string; ward: string | null; district: string | null;
  provinceNameEn: string | null; wardNameEn: string | null;
};
