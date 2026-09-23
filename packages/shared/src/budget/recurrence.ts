import type { IsoDate } from '../date.js';
import type { BudgetPeriod } from './types.js';

/** Harmonogram reguły cyklicznej — pola RecurringRule istotne dla kalendarza. */
export interface RecurrenceSchedule {
  frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  /** Co ile jednostek `frequency` (≥ 1). */
  interval: number;
  /** Początek cyklu — wyznacza fazę przy interval > 1 i miesiąc dla YEARLY. */
  startDate: IsoDate;
  /** MONTHLY/YEARLY: 1-31. Miesiąc krótszy niż kotwica → ostatni dzień miesiąca. */
  dayOfMonth: number | null;
  /** WEEKLY: 0 = niedziela ... 6 = sobota. */
  dayOfWeek: number | null;
}

/**
 * Daty wystąpień reguły w okresie (rosnąco, obie granice okresu włącznie).
 *
 * - Nic przed `startDate`.
 * - WEEKLY: pierwsze wystąpienie to pierwszy `dayOfWeek` od `startDate`,
 *   kolejne co `interval` tygodni.
 * - MONTHLY: co `interval` miesięcy licząc od miesiąca `startDate`.
 * - YEARLY: w miesiącu `startDate`, co `interval` lat.
 * - Kotwica 29-31 w krótszym miesiącu → ostatni dzień tego miesiąca
 *   (czynsz "31." płaci się 28/29 lutego, a nie wcale ani 3 marca).
 */
export declare function occurrencesInPeriod(
  schedule: RecurrenceSchedule,
  period: BudgetPeriod,
): IsoDate[];
