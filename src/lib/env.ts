import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  BUSINESS_TIMEZONE: z.string().min(1).default("Asia/Ho_Chi_Minh")
});

export function getServerEnv() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const developmentDatabaseUrl =
    "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh";

  return envSchema.parse({
    NODE_ENV: nodeEnv,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      (nodeEnv === "production" ? undefined : developmentDatabaseUrl),
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    BUSINESS_TIMEZONE: process.env.BUSINESS_TIMEZONE
  });
}
