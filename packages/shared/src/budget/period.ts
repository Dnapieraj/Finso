import type { IsoDate } from '../date.js';
import type { BudgetPeriod } from './types.js';

/**
 * "Jaki dziś jest dzień" dla użytkownika w jego strefie czasowej.
 *
 * JEDYNE miejsce, gdzie moment w czasie (instant) zamienia się w datę
 * kalendarzową — i jedyne, gdzie ma znaczenie DST. Czysta funkcja: zegar
 * (`instant`) podaje wywołujący, nigdy `new Date()` w środku.
 */
export declare function todayInTimeZone(instant: Date, timeZone: string): IsoDate;

/**
 * Bieżący okres budżetowy: od dnia `periodStartDay` miesiąca (włącznie)
 * do dnia przed kolejnym startem (włącznie).
 *
 * `periodStartDay` = 1 → miesiąc kalendarzowy. `periodStartDay` = 10 →
 * np. 10.09–09.10. Zakres 1-28 gwarantuje walidacja (updateMeSchema),
 * więc start okresu istnieje w każdym miesiącu.
 */
export declare function currentBudgetPeriod(today: IsoDate, periodStartDay: number): BudgetPeriod;

/**
 * Liczba okresów budżetowych (łącznie z bieżącym), w których jeszcze
 * można odkładać na cel z terminem `targetDate` — wejście dla
 * calculateGoalContribution.
 *
 * - termin w bieżącym okresie → 1 (trzeba domknąć teraz)
 * - termin już minął (`targetDate` < `today`) → 0 (cel po terminie)
 */
export declare function periodsUntil(
  today: IsoDate,
  targetDate: IsoDate,
  periodStartDay: number,
): number;
