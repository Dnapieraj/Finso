import {
  ruleStartDate,
  type BudgetPeriod,
  type IsoDate,
  type RuleCadence,
  type Schedule,
  type ScheduleOutput,
} from "@vireo/shared";

import { plural } from "../format/plural";
import { pl } from "../messages/pl";
import { parseDayOfMonth } from "../onboarding/draft";

const t = pl.budgetSettings;

/** The rhythms the app offers; other shapes (from the API) show but are not offered. */
export type Cadence = "MONTHLY" | "BIWEEKLY" | "WEEKLY";

/** The schedule part of a form, as typed and tapped. */
export interface ScheduleFields {
  cadence: Cadence;
  dayOfMonth: string;
  dayOfWeek: number | null;
  /** Only asked for every 2 weeks: which week has the next payment. */
  week: "this" | "next" | null;
}

export interface ScheduleErrors {
  dayOfMonth?: string;
  dayOfWeek?: string;
  week?: string;
}

export const emptySchedule: ScheduleFields = {
  cadence: "MONTHLY",
  dayOfMonth: "",
  dayOfWeek: null,
  week: null,
};

/** The form fields for a schedule from the API. */
export function scheduleFieldsOf(schedule: ScheduleOutput): ScheduleFields {
  const cadence: Cadence =
    schedule.frequency === "WEEKLY" ? (schedule.interval === 2 ? "BIWEEKLY" : "WEEKLY") : "MONTHLY";
  return {
    cadence,
    dayOfMonth: schedule.dayOfMonth === null ? "" : String(schedule.dayOfMonth),
    dayOfWeek: schedule.dayOfWeek,
    week: null,
  };
}

/**
 * Whether the form still says what the saved schedule says. Then nothing
 * is sent, and the rule keeps its start date — resending it would restart
 * the rule and could drop a payment already due in this period.
 */
export function isSameSchedule(fields: ScheduleFields, saved: ScheduleOutput | null): boolean {
  if (!saved) return false;
  const before = scheduleFieldsOf(saved);
  if (fields.cadence !== before.cadence) return false;
  if (fields.cadence === "MONTHLY") return parseDayOfMonth(fields.dayOfMonth) === saved.dayOfMonth;
  return fields.dayOfWeek === saved.dayOfWeek && fields.week === null;
}

/** The rhythm the user chose, checked; or a message per field. */
export function validateSchedule(
  fields: ScheduleFields,
): { ok: true; cadence: RuleCadence } | { ok: false; errors: ScheduleErrors } {
  if (fields.cadence === "MONTHLY") {
    return parseDayOfMonth(fields.dayOfMonth) === null
      ? { ok: false, errors: { dayOfMonth: t.schedule.dayError } }
      : { ok: true, cadence: { cadence: "MONTHLY" } };
  }
  const errors: ScheduleErrors = {};
  if (fields.dayOfWeek === null) errors.dayOfWeek = t.schedule.weekdayRequired;
  if (fields.cadence === "BIWEEKLY" && fields.week === null) errors.week = t.schedule.weekRequired;
  if (fields.dayOfWeek === null) return { ok: false, errors };
  if (fields.cadence === "WEEKLY") {
    return { ok: true, cadence: { cadence: "WEEKLY", dayOfWeek: fields.dayOfWeek } };
  }
  if (fields.week === null) return { ok: false, errors };
  return {
    ok: true,
    cadence: { cadence: "BIWEEKLY", dayOfWeek: fields.dayOfWeek, week: fields.week },
  };
}

/** The schedule to send, with its start date (see ruleStartDate in @vireo/shared). */
export function toSchedule(
  fields: ScheduleFields,
  cadence: RuleCadence,
  kind: "INCOME" | "EXPENSE",
  now: { today: IsoDate; period: BudgetPeriod },
): Schedule {
  const startDate = ruleStartDate({ ...cadence, kind, ...now });
  if (cadence.cadence === "MONTHLY") {
    return {
      frequency: "MONTHLY",
      interval: 1,
      startDate,
      dayOfMonth: parseDayOfMonth(fields.dayOfMonth),
      dayOfWeek: null,
    };
  }
  return {
    frequency: "WEEKLY",
    interval: cadence.cadence === "BIWEEKLY" ? 2 : 1,
    startDate,
    dayOfMonth: null,
    dayOfWeek: cadence.dayOfWeek,
  };
}

/** A schedule in words: "co miesiąc, 10. dnia", "co 2 tygodnie, w piątek". */
export function scheduleSummary(schedule: ScheduleOutput): string {
  const s = t.summary;
  const day = schedule.dayOfMonth ?? 1;
  const weekday = s.onWeekday[schedule.dayOfWeek ?? 1] ?? "";
  switch (schedule.frequency) {
    case "WEEKLY":
      return schedule.interval === 1
        ? s.weekly(weekday)
        : s.everyWeeks(schedule.interval, plural(schedule.interval, s.weeks), weekday);
    case "MONTHLY":
      return schedule.interval === 1
        ? s.monthly(day)
        : s.everyMonths(schedule.interval, plural(schedule.interval, s.months), day);
    case "YEARLY":
      return s.yearly(day);
  }
}
