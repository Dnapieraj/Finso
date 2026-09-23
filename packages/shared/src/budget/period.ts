import { addDays, isoDate, type IsoDate } from '../date.js';
import { clampedDayInMonth, monthIndexOf, yearMonth } from './calendar.js';
import type { BudgetPeriod } from './types.js';

/**
 * "Jaki dziś jest dzień" dla użytkownika w jego strefie czasowej.
 *
 * JEDYNE miejsce, gdzie moment w czasie (instant) zamienia się w datę
 * kalendarzową — i jedyne, gdzie ma znaczenie DST. Czysta funkcja: zegar
 * (`instant`) podaje wywołujący, nigdy `new Date()` w środku.
 *
 * Offset strefy liczy Intl (baza IANA w silniku JS), nie my — stały
 * offset typu "Warszawa = UTC+1" myli się o godzinę przez pół roku.
 */
export function todayInTimeZone(instant: Date, timeZone: string): IsoDate {
  // formatToParts, a nie gotowy string: kolejność i separatory zależą od
  // locale, a części mają stabilne nazwy.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  // isoDate() waliduje wynik — gdyby Intl kiedyś nie zwrócił którejś
  // części, dostaniemy wyjątek, a nie cicho błędną datę.
  return isoDate(`${parts.year}-${parts.month}-${parts.day}`);
}

/**
 * Bieżący okres budżetowy: od dnia `periodStartDay` miesiąca (włącznie)
 * do dnia przed kolejnym startem (włącznie).
 *
 * `periodStartDay` = 1 → miesiąc kalendarzowy. `periodStartDay` = 10 →
 * np. 10.09–09.10. Zakres 1-28 gwarantuje walidacja (updateMeSchema),
 * więc start okresu istnieje w każdym miesiącu.
 */
export function currentBudgetPeriod(today: IsoDate, periodStartDay: number): BudgetPeriod {
  const { day } = yearMonth(today);
  // Przed dniem startu jesteśmy jeszcze w okresie, który zaczął się
  // w poprzednim miesiącu.
  const startMonth = monthIndexOf(today) - (day < periodStartDay ? 1 : 0);
  const start = clampedDayInMonth(startMonth, periodStartDay);
  const nextStart = clampedDayInMonth(startMonth + 1, periodStartDay);
  return { start, end: addDays(nextStart, -1) };
}

/**
 * Liczba okresów budżetowych (łącznie z bieżącym), w których jeszcze
 * można odkładać na cel z terminem `targetDate` — wejście dla
 * calculateGoalContribution.
 *
 * - termin w bieżącym okresie → 1 (trzeba domknąć teraz)
 * - termin już minął (`targetDate` < `today`) → 0 (cel po terminie)
 */
export function periodsUntil(today: IsoDate, targetDate: IsoDate, periodStartDay: number): number {
  if (targetDate < today) {
    return 0;
  }
  // Okresy startują co miesiąc tego samego dnia, więc liczba okresów to
  // różnica miesięcy między startem bieżącego a startem okresu terminu.
  const current = currentBudgetPeriod(today, periodStartDay);
  const target = currentBudgetPeriod(targetDate, periodStartDay);
  return monthIndexOf(target.start) - monthIndexOf(current.start) + 1;
}
