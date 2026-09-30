import { z } from "zod";

import { amountSchema, idSchema } from "../common/schemas.js";
import { isValidTimeZone, PERIOD_START_DAY_MAX } from "../users/schemas.js";

/** Najwięcej zobowiązań w jednym onboardingu — zabezpieczenie, nie limit planu. */
export const ONBOARDING_COMMITMENTS_MAX = 30;

const nameSchema = z.string().trim().min(1).max(100);
/** Dzień miesiąca płatności. 29–31 w krótszych miesiącach przycina silnik budżetu. */
const dayOfMonthSchema = z.number().int().min(1).max(31);

/**
 * Dochód z onboardingu. `strictObject`: pole z drugiego rodzaju (np. kwota
 * przy nieregularnym) to błąd klienta, a nie coś do cichego pominięcia.
 */
export const onboardingIncomeSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("REGULAR"),
    name: nameSchema,
    /** Oczekiwana kwota miesięcznie. */
    amount: amountSchema,
    dayOfMonth: dayOfMonthSchema,
  }),
  z.strictObject({
    kind: z.literal("IRREGULAR"),
    name: nameSchema,
    /**
     * Ile już wpłynęło w bieżącym okresie — staje się potwierdzonym
     * wpływem, bo silnik liczy dochód nieregularny tylko z wpływów.
     * `null` = nic albo „nie chcę podawać”; 0 nie jest wpływem.
     */
    receivedThisPeriod: amountSchema.nullable().default(null),
  }),
]);

/** Stałe zobowiązanie z onboardingu — miesięczna reguła wydatku. */
export const onboardingCommitmentSchema = z.object({
  name: nameSchema,
  amount: amountSchema,
  dayOfMonth: dayOfMonthSchema,
  categoryId: idSchema,
});

/**
 * Body `POST /users/me/onboarding` — wszystko, czego silnik potrzebuje do
 * pierwszego budżetu, zapisywane naraz.
 */
export const completeOnboardingSchema = z.object({
  periodStartDay: z.number().int().min(1).max(PERIOD_START_DAY_MAX),
  /** Strefa telefonu — od niej zależy „dziś” w budżecie. */
  timezone: z.string().refine(isValidTimeZone),
  income: onboardingIncomeSchema,
  commitments: z.array(onboardingCommitmentSchema).max(ONBOARDING_COMMITMENTS_MAX).default([]),
  /**
   * Ile wydano od początku okresu, zanim użytkownik zaczął korzystać z
   * appki (bez stałych zobowiązań). Bez tego pierwszy budżet pokazałby za
   * dużo. `null` = pominięte.
   */
  spentThisPeriod: amountSchema.nullable().default(null),
});

/** Dochód z onboardingu. */
export type OnboardingIncome = z.infer<typeof onboardingIncomeSchema>;
/** Stałe zobowiązanie z onboardingu. */
export type OnboardingCommitment = z.infer<typeof onboardingCommitmentSchema>;
/** Body onboardingu po walidacji (z domyślnymi wartościami). */
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
/** Body onboardingu, jak wysyła je klient (pola z domyślną wartością są opcjonalne). */
export type CompleteOnboardingRequest = z.input<typeof completeOnboardingSchema>;
