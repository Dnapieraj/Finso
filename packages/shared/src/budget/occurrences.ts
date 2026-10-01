import { addDays, type IsoDate } from "../date.js";
import { currentBudgetPeriod } from "./period.js";
import { occurrencesInPeriod, type RecurrenceSchedule } from "./recurrence.js";
import type { BudgetPeriod } from "./types.js";

/** Status zapisu — jak `ConfirmationStatus` w Prismie. */
export type ConfirmationStatus = "PENDING" | "CONFIRMED" | "DECLINED";

/**
 * Zapis powiązany z regułą: wpływ ze źródła albo transakcja z regułą.
 * `occurrenceDate` mówi, na który termin odpowiada; brak (wpis ręczny
 * lub sprzed potwierdzania) — patrz {@link openOccurrences}.
 */
export interface OccurrenceRecord {
  date: IsoDate;
  occurrenceDate?: IsoDate | null;
  status: ConfirmationStatus;
}

/** Terminy reguły bez odpowiedzi. */
export interface OpenOccurrences {
  /** Z poprzednich okresów (od startu reguły) — zaległe. */
  overdue: IsoDate[];
  /** Z bieżącego okresu, także te jeszcze przed nami. */
  current: IsoDate[];
}

/**
 * Które terminy reguły nikt jeszcze nie zamknął — od startu reguły do
 * końca bieżącego okresu.
 *
 * Termin zamyka zapis CONFIRMED (zapłacone / wpłynęło) albo DECLINED
 * („Nie w tym okresie”). PENDING („Jeszcze nie”) niczego nie zamyka.
 * Zapis z `occurrenceDate` zamyka dokładnie ten termin; zapis bez niego
 * zamyka najwcześniejszy otwarty termin w okresie swojej daty — tak
 * liczył budżet, zanim zapisy dostały termin, więc stare dane się nie
 * zmieniają.
 *
 * Zaległe są tylko terminy od `trackedSince` (dnia, w którym reguła trafiła
 * do Finso): wcześniejsze użytkownik płacił bez appki, więc nie ma o co
 * pytać — nawet jeśli start harmonogramu jest dawniej (wpisany ręcznie
 * albo przesunięty przy zmianie dnia wypłaty).
 */
export function openOccurrences(
  schedule: RecurrenceSchedule,
  records: OccurrenceRecord[],
  period: BudgetPeriod,
  periodStartDay: number,
  trackedSince: IsoDate = schedule.startDate,
): OpenOccurrences {
  const lastPastDay = addDays(period.start, -1);
  const past =
    schedule.startDate <= lastPastDay
      ? occurrencesInPeriod(schedule, { start: schedule.startDate, end: lastPastDay })
      : [];
  const all = [...past, ...occurrencesInPeriod(schedule, period)];
  const existing = new Set(all);
  const closing = records.filter((record) => record.status !== "PENDING");
  const closed = new Set<IsoDate>();

  for (const record of closing) {
    if (record.occurrenceDate && existing.has(record.occurrenceDate)) {
      closed.add(record.occurrenceDate);
    }
  }
  for (const record of closing) {
    if (record.occurrenceDate) continue;
    const ownPeriod = currentBudgetPeriod(record.date, periodStartDay);
    const earliest = all.find(
      (date) => date >= ownPeriod.start && date <= ownPeriod.end && !closed.has(date),
    );
    if (earliest) closed.add(earliest);
  }

  const open = all.filter((date) => !closed.has(date));
  return {
    overdue: open.filter((date) => date < period.start && date >= trackedSince),
    current: open.filter((date) => date >= period.start),
  };
}
