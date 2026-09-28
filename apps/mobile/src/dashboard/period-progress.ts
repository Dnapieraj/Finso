import { addDays, daysBetween, isoDate } from "@vireo/shared";

/** Where "today" falls in the budget period. */
export interface PeriodProgress {
  /** Today as day N of the period, 1-based. */
  day: number;
  totalDays: number;
  /** `day / totalDays`, for the bar width. */
  ratio: number;
  /** The day after the period ends: the next payday. */
  payday: string;
}

/**
 * Pure calendar-date arithmetic on the API's `period` and `asOf` — both
 * already computed in the user's time zone, so no DST here.
 */
export function periodProgress({
  period,
  asOf,
}: {
  period: { start: string; end: string };
  asOf: string;
}): PeriodProgress {
  const start = isoDate(period.start);
  const end = isoDate(period.end);
  const totalDays = daysBetween(start, end) + 1;
  const day = Math.min(Math.max(daysBetween(start, isoDate(asOf)) + 1, 1), totalDays);
  return { day, totalDays, ratio: day / totalDays, payday: addDays(end, 1) };
}
