import { addDays, daysBetween, formatMoney, grosze, isoDate, todayInTimeZone } from "@vireo/shared";

import { plural } from "../format/plural";
import { pl } from "../messages/pl";
import { HIDDEN_AMOUNT } from "../privacy/money";

const t = pl.widget;

/**
 * What the app saved for the home screen widget the last time it loaded the
 * budget. The widget runs without the API, so this is all it knows.
 */
export interface WidgetSnapshot {
  /** The budget's „today” (user's zone) when it was loaded. */
  asOf: string;
  timeZone: string;
  /** Last day of the period; payday is the day after. */
  periodEnd: string;
  /** What is left for the whole period, in grosze; negative = below the line. */
  available: number;
  /** What is left for today, in grosze; negative = over today's plan. */
  todayLeft: number;
  /** Privacy mode or app lock: the home screen is visible to anyone. */
  hidden: boolean;
}

export type WidgetContent =
  | { kind: "amount"; title: string; amount: string; detail: string }
  | { kind: "message"; title: string; detail: string };

/**
 * The widget's text. Numbers from another day are never shown — today's
 * limit changes overnight, and a wrong amount on the home screen is worse
 * than asking to open the app.
 */
export function widgetContent(snapshot: WidgetSnapshot | null, now: Date): WidgetContent {
  // A snapshot without the balance was saved by an older version: it cannot
  // say „below the line”, so it is not shown at all.
  if (!snapshot || typeof snapshot.available !== "number") {
    return { kind: "message", title: t.appName, detail: t.openApp };
  }
  const today = todayInTimeZone(now, snapshot.timeZone);
  if (today !== snapshot.asOf) return { kind: "message", title: t.appName, detail: t.refresh };

  // Like Start: below the line for the period, today's plan means nothing.
  const below = snapshot.available < 0;
  const shown = below ? snapshot.available : snapshot.todayLeft;
  const over = shown < 0;
  // What is left rounds down, a shortfall up — never better than it is.
  const amount = snapshot.hidden
    ? HIDDEN_AMOUNT
    : formatMoney(grosze(Math.abs(shown)), { whole: over ? "up" : "down" });
  const daysToPayday = daysBetween(today, addDays(isoDate(snapshot.periodEnd), 1));
  const detail =
    daysToPayday === 1
      ? t.paydayTomorrow
      : t.paydayIn(daysToPayday, plural(daysToPayday, pl.dashboard.days));
  // Hidden: anyone can see the home screen, and the title alone would tell.
  const title = snapshot.hidden
    ? pl.dashboard.title
    : below
      ? pl.dashboard.underTheLine
      : over
        ? t.over
        : t.left;
  return { kind: "amount", title, amount, detail };
}
