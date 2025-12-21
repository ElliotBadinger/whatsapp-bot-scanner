import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
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
  CONTROL_PLANE_API_TOKEN: z.string().trim().min(1),
});

export type Env = z.infer<typeof serverEnvSchema>;

let cachedEnv: Env | undefined;

export function validateEnv(): Env {
  const parsed = serverEnvSchema.parse({
    CONTROL_PLANE_URL: process.env.CONTROL_PLANE_URL,
    CONTROL_PLANE_API_TOKEN: process.env.CONTROL_PLANE_API_TOKEN,
  });

  cachedEnv = parsed;
  return parsed;
}

export function getEnv(): Env {
  return cachedEnv ?? validateEnv();
}
