import {
  addDays,
  isoDate,
  occurrencesInPeriod,
  type DueConfirmation,
  type IncomeSource,
  type IsoDate,
  type RecurrenceSchedule,
  type RecurringRule,
} from "@vireo/shared";

import { formatExpected } from "../confirmations/format";
import { plural } from "../format/plural";
import { pl } from "../messages/pl";

const t = pl.notifications.reminder;
const ask = pl.confirmations.ask;

/** Planned this far ahead; the plan is rebuilt every time the app opens. */
const HORIZON_DAYS = 30;
/** Daily nudges about unanswered items, starting tomorrow. */
const OVERDUE_DAYS = 7;
/** iOS keeps at most 64 pending notifications and drops the rest silently. */
const MAX_REMINDERS = 60;
const REMINDER_HOUR = 9;

/** Which reminders the user wants; stored on the device, not the account. */
export interface ReminderPreferences {
  payday: boolean;
  payments: boolean;
  overdue: boolean;
  /** Off by default: notifications show on the lock screen. */
  showAmounts: boolean;
}

/** One local notification to schedule. */
export interface Reminder {
  /** Stable for the same item and day, e.g. `payment:<ruleId>:2026-10-05`. */
  id: string;
  at: Date;
  title: string;
  body: string;
}

/** 9:00 in the device's time zone on a calendar day. */
function reminderTime(date: IsoDate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, REMINDER_HOUR, 0);
}

/**
 * Local reminders for the next 30 days: income and fixed payments on their
 * day at 9:00, and a daily nudge for a week while answers are missing.
 *
 * Today's due date gets a reminder only while it still waits for an answer
 * (and not after „Jeszcze nie”), and nothing is planned in the past. At most
 * 60 reminders, the nearest first.
 */
export function planReminders({
  today,
  now,
  incomeSources,
  rules,
  due,
  preferences,
}: {
  /** The user's "today" as the API computed it (`budget.asOf`). */
  today: string;
  now: Date;
  incomeSources: readonly IncomeSource[];
  rules: readonly RecurringRule[];
  due: readonly DueConfirmation[];
  preferences: ReminderPreferences;
}): Reminder[] {
  const start = isoDate(today);
  const horizon = { start, end: addDays(start, HORIZON_DAYS) };
  const reminders: Reminder[] = [];

  const askedToday = (id: string) =>
    due.some((item) => item.id === id && item.occurrenceDate === today && item.askToday);
  const add = (reminder: Reminder) => {
    if (reminder.at.getTime() > now.getTime()) reminders.push(reminder);
  };

  function addOccurrences(
    kind: "payday" | "payment",
    id: string,
    schedule: RecurrenceSchedule,
    title: string,
    body: string,
  ) {
    for (const date of occurrencesInPeriod(schedule, horizon)) {
      if (date === start && !askedToday(id)) continue;
      add({ id: `${kind}:${id}:${date}`, at: reminderTime(date), title, body });
    }
  }

  if (preferences.payday) {
    for (const source of incomeSources) {
      if (!source.isActive || source.kind !== "REGULAR") continue;
      if (!source.schedule || source.expectedAmount === null) continue;
      addOccurrences(
        "payday",
        source.id,
        { ...source.schedule, startDate: isoDate(source.schedule.startDate) },
        t.paydayTitle,
        preferences.showAmounts
          ? ask(source.name, formatExpected(source.expectedAmount), "INCOME")
          : t.paydayPrivate(source.name),
      );
    }
  }

  if (preferences.payments) {
    for (const rule of rules) {
      // Income rules come through their income source, with its name.
      if (!rule.isActive || rule.kind !== "EXPENSE" || rule.expectedAmount === null) continue;
      const label = rule.name ?? "";
      addOccurrences(
        "payment",
        rule.id,
        { ...rule, startDate: isoDate(rule.startDate) },
        t.paymentTitle,
        preferences.showAmounts
          ? ask(label, formatExpected(rule.expectedAmount), "EXPENSE")
          : t.paymentPrivate(label),
      );
    }
  }

  if (preferences.overdue && due.length > 0) {
    // Whatever waits now will still wait tomorrow unless answered; answering
    // in the app rebuilds the plan and drops these.
    const body = t.overdue(due.length, plural(due.length, t.items));
    for (let day = 1; day <= OVERDUE_DAYS; day += 1) {
      const date = addDays(start, day);
      add({ id: `overdue:${date}`, at: reminderTime(date), title: t.overdueTitle, body });
    }
  }

  return reminders.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_REMINDERS);
}
