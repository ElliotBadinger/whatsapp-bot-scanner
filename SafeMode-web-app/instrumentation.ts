import { validateEnv } from "@/lib/env";
import { validatePublicEnv } from "@/lib/public-env";

export function register(): void {
  validatePublicEnv();
  validateEnv();
}
