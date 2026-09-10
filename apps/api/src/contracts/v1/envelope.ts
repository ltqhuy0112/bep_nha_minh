import { z } from "zod";

export const API_VERSION = "v1" as const;

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1)
});

export const apiSuccessEnvelopeSchema = z.object({
  version: z.literal(API_VERSION),
  data: z.unknown()
});

export const apiErrorEnvelopeSchema = z.object({
  version: z.literal(API_VERSION),
  error: apiErrorSchema
});

export type ApiSuccessEnvelope<T> = {
  version: typeof API_VERSION;
  data: T;
};

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;

export function successEnvelope<T>(data: T): ApiSuccessEnvelope<T> {
  return { version: API_VERSION, data };
}

export function errorEnvelope(code: string, message: string): ApiErrorEnvelope {
  return { version: API_VERSION, error: { code, message } };
}
