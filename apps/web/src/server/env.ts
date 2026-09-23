import "server-only";

import { z } from "zod";

const envSchema = z.object({
  /** Base URL of the Finso API, reachable from the Next server (not the browser). */
  API_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Validated server environment. Parsed on first use rather than at import,
 * so `next build` can analyse route modules without a full .env present.
 */
export function getEnv(): Env {
  cached ??= envSchema.parse(process.env);
  return cached;
}
