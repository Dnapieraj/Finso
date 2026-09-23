import { z } from "zod";

/** Plan subskrypcji — lustrzane odbicie enuma `SubscriptionPlan` z bazy. */
export const subscriptionPlanSchema = z.enum(["FREE", "PLUS"]);

/** Najpóźniejszy dzień startu okresu — każdy miesiąc ma co najmniej 28 dni. */
export const PERIOD_START_DAY_MAX = 28;

/**
 * Czy `value` to strefa czasowa IANA znana środowisku (np. "Europe/Warsaw").
 * Przez konstruktor Intl, a nie `Intl.supportedValuesOf`, bo ten drugi
 * nie zawiera aliasów typu "UTC" w części silników JS.
 */
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Publiczny widok użytkownika zwracany przez API. Jawna lista pól
 * (a nie "wszystko poza hasłem") — nowa kolumna w tabeli User nie
 * wycieknie do klienta, dopóki ktoś świadomie jej tu nie doda.
 */
export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  plan: subscriptionPlanSchema,
  currency: z.string(),
  timezone: z.string(),
  periodStartDay: z.number().int(),
});

/** Body `PATCH /users/me` — ustawienia wpływające na liczenie budżetu. */
export const updateMeSchema = z.object({
  timezone: z.string().refine(isValidTimeZone).optional(),
  periodStartDay: z.number().int().min(1).max(PERIOD_START_DAY_MAX).optional(),
});

/** Publiczny widok użytkownika. */
export type PublicUser = z.infer<typeof publicUserSchema>;
/** Body aktualizacji ustawień użytkownika. */
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
