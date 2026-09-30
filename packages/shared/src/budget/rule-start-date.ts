import { addDays, daysBetween, type IsoDate } from "../date.js";
import { dayOfWeekOf } from "./calendar.js";
import type { BudgetPeriod } from "./types.js";

const DAYS_PER_WEEK = 7;
const BIWEEKLY_DAYS = 14;

/** Rytm reguły tak, jak wybiera go użytkownik. */
export type RuleCadence =
  | { cadence: "MONTHLY" }
  | { cadence: "WEEKLY"; dayOfWeek: number }
  | {
      cadence: "BIWEEKLY";
      /** 0 = niedziela … 6 = sobota, jak `RecurringRule.dayOfWeek`. */
      dayOfWeek: number;
      /** W którym tygodniu (od poniedziałku) jest najbliższa płatność. */
      week: "this" | "next";
    };

/** Wejście {@link ruleStartDate}. */
export type RuleStartDateInput = RuleCadence & {
  kind: "INCOME" | "EXPENSE";
  /** „Dziś” w strefie użytkownika. */
  today: IsoDate;
  /** Bieżący okres budżetowy. */
  period: BudgetPeriod;
};

/**
 * `startDate` nowej (albo zmienionej) reguły cyklicznej — od niej silnik
 * liczy wystąpienia w okresie.
 *
 * - **Dochód** od początku bieżącego okresu: wypłata sprzed dziś też jest
 *   dochodem tego okresu, a podwójnego liczenia nie ma, bo silnik odejmuje
 *   potwierdzone wpływy od oczekiwanych wystąpień.
 * - **Zobowiązanie** od dziś: zapłacone wcześniej jest już wydatkiem
 *   (bez powiązania z regułą), więc liczone od początku okresu odjęłoby
 *   się dwa razy.
 *
 * „Co 2 tygodnie” wymaga fazy — KTÓRE tygodnie. Faza to wybrany dzień
 * w tym albo przyszłym tygodniu (od poniedziałku). Zobowiązanie startuje
 * od najbliższej płatności nie wcześniejszej niż dziś; dochód od
 * wystąpienia w tej samej fazie, najpóźniejszego nie później niż początek
 * okresu (żeby objąć wszystkie wypłaty okresu).
 */
export function ruleStartDate(input: RuleStartDateInput): IsoDate {
  const { kind, today, period } = input;
  if (input.cadence !== "BIWEEKLY") return kind === "INCOME" ? period.start : today;

  const anchor = addDays(
    weekdayInWeekOf(today, input.dayOfWeek),
    input.week === "next" ? DAYS_PER_WEEK : 0,
  );
  if (kind === "EXPENSE") {
    return daysBetween(today, anchor) >= 0 ? anchor : addDays(anchor, BIWEEKLY_DAYS);
  }
  // Tyle pełnych dwutygodni wstecz, żeby wylądować w dniu startu albo przed nim.
  const steps = Math.ceil(Math.max(0, daysBetween(period.start, anchor)) / BIWEEKLY_DAYS);
  return addDays(anchor, -steps * BIWEEKLY_DAYS);
}

/** Dzień tygodnia `dayOfWeek` w tygodniu (pon–nd) zawierającym `date`. */
function weekdayInWeekOf(date: IsoDate, dayOfWeek: number): IsoDate {
  // Poniedziałek = 0 … niedziela = 6: polski tydzień zaczyna się w poniedziałek.
  const fromMonday = (weekday: number) => (weekday + 6) % DAYS_PER_WEEK;
  const monday = addDays(date, -fromMonday(dayOfWeekOf(date)));
  return addDays(monday, fromMonday(dayOfWeek));
}
