import "server-only";

import { z } from "zod";

// Note: Server code should use `getEnv()` (not `process.env.*`) so deprecations and validation
// stay centralized here.

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
let didWarnDeprecatedControlPlaneBase = false;

export function validateEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const controlPlaneUrl =
    process.env.CONTROL_PLANE_URL ?? process.env.CONTROL_PLANE_BASE;

  if (!controlPlaneUrl) {
    throw new Error(
      "SafeMode-web-app: CONTROL_PLANE_URL is required (or CONTROL_PLANE_BASE during the deprecation period).",
    );
  }

  if (
    !didWarnDeprecatedControlPlaneBase &&
    !process.env.CONTROL_PLANE_URL &&
    process.env.CONTROL_PLANE_BASE &&
    process.env.NODE_ENV !== "production"
  ) {
    didWarnDeprecatedControlPlaneBase = true;
    console.warn(
      "SafeMode-web-app: CONTROL_PLANE_BASE is deprecated and will be removed in a future release; use CONTROL_PLANE_URL instead.",
    );
  }

  const parsed = serverEnvSchema.parse({
    CONTROL_PLANE_URL: controlPlaneUrl,
    CONTROL_PLANE_API_TOKEN: process.env.CONTROL_PLANE_API_TOKEN,
  });

  cachedEnv = parsed;
  return parsed;
}

export function getEnv(): Env {
  return cachedEnv ?? validateEnv();
}
