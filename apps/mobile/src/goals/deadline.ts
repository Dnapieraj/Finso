import { isoDate, type IsoDate } from "@vireo/shared";

/** A deadline as the form holds it: a month (0–11) of a year. */
export interface MonthOfYear {
  year: number;
  month: number;
}

/** The month a date falls in. */
export function monthOf(date: string): MonthOfYear {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 };
}

/**
 * The goal's target date: the last day of the chosen month. Savings goals
 * are planned by the month, and "by June" means the money is there by the
 * end of June — not on the 1st.
 */
export function lastDayOf({ year, month }: MonthOfYear): IsoDate {
  // Day 0 of the next month is the last day of this one (29 February included).
  const day = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return isoDate(
    `${String(year)}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  );
}

/** Whether `a` is before `b`, by month. */
export function isBeforeMonth(a: MonthOfYear, b: MonthOfYear): boolean {
  return a.year < b.year || (a.year === b.year && a.month < b.month);
}
