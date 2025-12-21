import { validateEnv } from "@/lib/env";
import { validatePublicEnv } from "@/lib/public-env";

// Next.js instrumentation hook.
// Note: `getEnv()` / `getPublicEnv()` also validate lazily on first access; this is just fail-fast.
// This intentionally runs in all environments (dev/build/prod) so misconfiguration is caught early.
export function register(): void {
  // Note: `NEXT_PUBLIC_*` values are baked into the client bundle at build time.
  validatePublicEnv();
  validateEnv();
}
