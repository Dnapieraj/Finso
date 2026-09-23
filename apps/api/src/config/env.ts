import { z } from 'zod';

/**
 * Schemat zmiennych środowiskowych API. Walidowany raz, przy starcie —
 * brakujący sekret JWT wywala aplikację od razu, zamiast pozwolić jej
 * podpisywać tokeny kluczem `undefined`.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),

  /**
   * Klucz HMAC do podpisu access tokenów (HS256). 32 bajty to minimum
   * dla HS256 — krótszy klucz da się złamać offline z samego tokena.
   */
  JWT_ACCESS_SECRET: z.string().min(32),
  /** Krótki czas życia: skradziony access token jest ważny tylko chwilę. */
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  /** Okno bezczynności — po tylu dniach bez odświeżenia trzeba się zalogować. */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** Limit żądań na endpoint auth na IP w oknie AUTH_THROTTLE_TTL_SECONDS. */
  AUTH_THROTTLE_LIMIT: z.coerce.number().int().positive().default(10),
  AUTH_THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
});

/** Zwalidowana konfiguracja — `ConfigService<Env, true>` daje typowany `get`. */
export type Env = z.infer<typeof envSchema>;

/**
 * Funkcja `validate` dla ConfigModule. Rzuca czytelną listą problemów,
 * bez wartości zmiennych (mogą być sekretami, a trafią do logów).
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
