import { z } from 'zod';

import { publicUserSchema } from '../users/schemas.js';

// Schematy nie mają własnych komunikatów błędów. Kody issue Zoda
// (`too_small`, `invalid_format`...) są stabilne i maszynowo czytelne —
// web i mobile mapują je na teksty UI w swoim katalogu tłumaczeń, więc
// polskie zdania nie lądują w pakiecie współdzielonym.

/** Minimalna długość hasła przy rejestracji (NIST SP 800-63B). */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Maksymalna długość hasła. Nie ze względów bezpieczeństwa hasła, tylko
 * serwera — argon2 na bardzo długim wejściu to tani sposób na zajęcie CPU.
 */
export const PASSWORD_MAX_LENGTH = 128;

/**
 * E-mail znormalizowany do postaci kanonicznej (bez spacji, małe litery).
 * Normalizacja przed walidacją formatu — inaczej " jan@example.com"
 * zostałby odrzucony, choć użytkownik wpisał poprawny adres.
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** Hasło przy zakładaniu konta — tu obowiązuje polityka długości. */
export const newPasswordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

/**
 * Hasło podawane do weryfikacji (logowanie, potwierdzenie usunięcia konta).
 * Bez minimum — polityka mogła się zmienić od czasu rejestracji.
 */
export const existingPasswordSchema = z.string().min(1).max(PASSWORD_MAX_LENGTH);

/** Body `POST /auth/register`. */
export const registerSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
});

/** Body `POST /auth/login`. */
export const loginSchema = z.object({
  email: emailSchema,
  password: existingPasswordSchema,
});

/** Body `POST /auth/refresh` i `POST /auth/logout`. */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(512),
});

/** Body `DELETE /users/me` — usunięcie konta wymaga ponownego podania hasła. */
export const deleteAccountSchema = z.object({
  password: existingPasswordSchema,
});

/** Para tokenów wydawana przy logowaniu, rejestracji i odświeżeniu sesji. */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Czas życia access tokena w sekundach — klient wie, kiedy odświeżyć. */
  accessTokenExpiresIn: z.number().int(),
});

/** Odpowiedź `POST /auth/register` i `POST /auth/login`. */
export const authSessionSchema = authTokensSchema.extend({
  user: publicUserSchema,
});

/** Dane rejestracji po walidacji. */
export type RegisterInput = z.infer<typeof registerSchema>;
/** Dane logowania po walidacji. */
export type LoginInput = z.infer<typeof loginSchema>;
/** Body z refresh tokenem. */
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
/** Body potwierdzenia usunięcia konta. */
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
/** Para tokenów sesji. */
export type AuthTokens = z.infer<typeof authTokensSchema>;
/** Sesja: tokeny + użytkownik. */
export type AuthSession = z.infer<typeof authSessionSchema>;
