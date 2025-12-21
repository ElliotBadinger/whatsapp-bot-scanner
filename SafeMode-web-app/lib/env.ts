import "server-only";

import { z } from "zod";

const envSchema = z.object({
  CONTROL_PLANE_URL: z
    .string()
    .trim()
    .min(1)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "must be a valid http(s) URL"),
  CONTROL_PLANE_API_TOKEN: z
    .string()
    .trim()
    .min(1),
  NEXT_PUBLIC_BOT_PHONE_NUMBER: z
    .string()
    .trim()
    .min(1),
  NEXT_PUBLIC_WA_ME_LINK: z
    .string()
    .trim()
    .url(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function validateEnv(): Env {
  const parsed = envSchema.parse({
    CONTROL_PLANE_URL: process.env.CONTROL_PLANE_URL,
    CONTROL_PLANE_API_TOKEN: process.env.CONTROL_PLANE_API_TOKEN,
    NEXT_PUBLIC_BOT_PHONE_NUMBER: process.env.NEXT_PUBLIC_BOT_PHONE_NUMBER,
    NEXT_PUBLIC_WA_ME_LINK: process.env.NEXT_PUBLIC_WA_ME_LINK,
  });

  cachedEnv = parsed;
  return parsed;
}

export function getEnv(): Env {
  return cachedEnv ?? validateEnv();
}
