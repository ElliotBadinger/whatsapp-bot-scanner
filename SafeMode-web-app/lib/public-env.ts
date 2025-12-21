import { z } from "zod";

// All public env vars must be explicitly whitelisted here.
// Any new `NEXT_PUBLIC_*` value that the app depends on should be added to this schema.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_BOT_PHONE_NUMBER: z
    .string()
    .trim()
    .regex(
      /^\+[1-9]\d{6,14}$/,
      "must be an international phone number (e.g. +1234567890)",
    ),
  NEXT_PUBLIC_WA_ME_LINK: z.string().trim().url(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedEnv: PublicEnv | undefined;

export function validatePublicEnv(): PublicEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = publicEnvSchema.parse({
    NEXT_PUBLIC_BOT_PHONE_NUMBER: process.env.NEXT_PUBLIC_BOT_PHONE_NUMBER,
    NEXT_PUBLIC_WA_ME_LINK: process.env.NEXT_PUBLIC_WA_ME_LINK,
  });

  cachedEnv = parsed;
  return parsed;
}

export function getPublicEnv(): PublicEnv {
  return cachedEnv ?? validatePublicEnv();
}
