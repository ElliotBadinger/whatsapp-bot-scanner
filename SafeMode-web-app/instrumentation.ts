import { validateEnv } from "@/lib/env";
import { validatePublicEnv } from "@/lib/public-env";

export function register(): void {
  // Note: `NEXT_PUBLIC_*` values are baked into the client bundle at build time.
  validatePublicEnv();
  validateEnv();
}
