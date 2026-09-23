import { addDays, daysBetween, type IsoDate } from '../date.js';
import { clampedDayInMonth, dayOfWeekOf, laterOf, monthIndexOf, yearMonth } from './calendar.js';
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
 *
 * Brak `dayOfMonth`/`dayOfWeek` (walidacja API do tego nie dopuszcza)
 * → dzień ze `startDate`, zamiast cicho zwracać zero wystąpień.
 */
export function occurrencesInPeriod(
  schedule: RecurrenceSchedule,
  period: BudgetPeriod,
): IsoDate[] {
  const from = laterOf(period.start, schedule.startDate);
  if (from > period.end) {
    return [];
  }
  return schedule.frequency === 'WEEKLY'
    ? weeklyOccurrences(schedule, from, period.end)
    : monthlyOccurrences(schedule, from, period.end);
}

function weeklyOccurrences(schedule: RecurrenceSchedule, from: IsoDate, to: IsoDate): IsoDate[] {
  const targetDay = schedule.dayOfWeek ?? dayOfWeekOf(schedule.startDate);
  const first = addDays(
    schedule.startDate,
    (targetDay - dayOfWeekOf(schedule.startDate) + 7) % 7,
  );
  const step = 7 * schedule.interval;
  // Przeskok od pierwszego wystąpienia prosto do pierwszego >= `from`,
  // zamiast iterować tydzień po tygodniu od (być może odległego) startu.
  const stepsToSkip = Math.max(0, Math.ceil(daysBetween(first, from) / step));
  const dates: IsoDate[] = [];
  for (let date = addDays(first, stepsToSkip * step); date <= to; date = addDays(date, step)) {
    dates.push(date);
  }
  return dates;
}

function monthlyOccurrences(schedule: RecurrenceSchedule, from: IsoDate, to: IsoDate): IsoDate[] {
  const day = schedule.dayOfMonth ?? yearMonth(schedule.startDate).day;
  const stepMonths = schedule.interval * (schedule.frequency === 'YEARLY' ? 12 : 1);
  const anchor = monthIndexOf(schedule.startDate);
  const dates: IsoDate[] = [];
  // Każdy miesiąc zakresu ma co najwyżej jedno wystąpienie, więc wystarczy
  // sprawdzić je po kolei (okres budżetowy to najwyżej dwa miesiące).
  // `month - anchor` nie bywa ujemne: `from` jest zawsze >= startDate.
  for (let month = monthIndexOf(from); month <= monthIndexOf(to); month += 1) {
    if ((month - anchor) % stepMonths !== 0) {
      continue;
    }
    const date = clampedDayInMonth(month, day);
    if (date >= from && date <= to) {
      dates.push(date);
    }
  }
  return dates;
}
