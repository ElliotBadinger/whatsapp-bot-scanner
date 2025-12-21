import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_BOT_PHONE_NUMBER: z.string().trim().min(1),
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
