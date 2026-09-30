import { describe, expect, it } from "vitest";

import { isoDate, type IsoDate } from "../date.js";
import { currentBudgetPeriod } from "./period.js";
import { occurrencesInPeriod, type RecurrenceSchedule } from "./recurrence.js";
import { rebaseRuleStarts, type RebasedRule } from "./rebase-rule-starts.js";

type Kind = RebasedRule["kind"];

let nextId = 0;

/** A rule as the API stores it; monthly on the 5th unless told otherwise. */
function rule(
  kind: Kind,
  startDate: string,
  schedule: Partial<RecurrenceSchedule> = {},
): RebasedRule & RecurrenceSchedule {
  nextId += 1;
  return {
    id: `rule-${String(nextId)}`,
    kind,
    frequency: "MONTHLY",
    interval: 1,
    dayOfMonth: 5,
    dayOfWeek: null,
    ...schedule,
    startDate: isoDate(startDate),
  };
}

/** Wednesday 23 September 2026 — onboarding day in most cases. */
const TODAY = isoDate("2026-09-23");

function rebase(
  rules: RebasedRule[],
  from: number,
  to: number,
  { today = TODAY, onboardedOn = TODAY }: { today?: IsoDate; onboardedOn?: IsoDate | null } = {},
) {
  return rebaseRuleStarts(rules, {
    today,
    fromPeriodStartDay: from,
    toPeriodStartDay: to,
    onboardedOn,
  });
}

/** New start date of `target`, or its old one when the result leaves it alone. */
function startOf(target: RebasedRule, changes: { id: string; startDate: IsoDate }[]): IsoDate {
  return changes.find((change) => change.id === target.id)?.startDate ?? target.startDate;
}

describe("rebaseRuleStarts", () => {
  describe("the period starts earlier (10 → 1: 10.09–9.10 becomes 1.09–30.09)", () => {
    it("an income from the old period start moves to the new one", () => {
      const salary = rule("INCOME", "2026-09-10", { dayOfMonth: 10 });

      expect(rebase([salary], 10, 1)).toEqual([{ id: salary.id, startDate: "2026-09-01" }]);
    });

    it("a commitment from onboarding moves too: rent paid on 5.09 before Finso is in no expense", () => {
      const rent = rule("EXPENSE", "2026-09-10");

      expect(rebase([rent], 10, 1)).toEqual([{ id: rent.id, startDate: "2026-09-01" }]);
    });

    it("so the rent of the new period is counted — not lost", () => {
      const rent = rule("EXPENSE", "2026-09-10");
      const newPeriod = currentBudgetPeriod(TODAY, 1);

      expect(occurrencesInPeriod(rent, newPeriod)).toEqual([]);
      const rebased = { ...rent, startDate: startOf(rent, rebase([rent], 10, 1)) };
      expect(occurrencesInPeriod(rebased, newPeriod)).toEqual(["2026-09-05"]);
    });

    it("a commitment added later ('from today') stays: an earlier payment may be a saved expense", () => {
      const gym = rule("EXPENSE", "2026-09-23", { dayOfMonth: 20 });

      expect(rebase([gym], 10, 1)).toEqual([]);
    });

    it("a commitment from the old period start, added after onboarding, stays for the same reason", () => {
      // Onboarded in August; this one was added in Settings on 10 September.
      const gym = rule("EXPENSE", "2026-09-10");

      expect(rebase([gym], 10, 1, { onboardedOn: isoDate("2026-08-20") })).toEqual([]);
    });

    it("an income added after onboarding moves anyway: confirmed entries are subtracted, never doubled", () => {
      const bonus = rule("INCOME", "2026-09-10", { dayOfMonth: 15 });

      expect(rebase([bonus], 10, 1, { onboardedOn: isoDate("2026-08-20") })).toEqual([
        { id: bonus.id, startDate: "2026-09-01" },
      ]);
    });

    it("a rule already starting before the new period start is left alone", () => {
      const old = rule("EXPENSE", "2026-08-10");

      expect(rebase([old], 10, 1)).toEqual([]);
    });

    it("every week: the weekday alone sets the dates, so the new period start will do", () => {
      const lessons = rule("INCOME", "2026-09-10", {
        frequency: "WEEKLY",
        dayOfMonth: null,
        dayOfWeek: 1,
      });

      expect(rebase([lessons], 10, 1)).toEqual([{ id: lessons.id, startDate: "2026-09-01" }]);
    });

    it("every 2 weeks: moved back by whole 2-week steps, so the same Fridays stay paydays", () => {
      const grant = rule("INCOME", "2026-09-04", {
        frequency: "WEEKLY",
        interval: 2,
        dayOfMonth: null,
        dayOfWeek: 5,
      });
      // Phase date 4.09 (before 10.09) but after 1.09: one step back.
      const [change] = rebase([grant], 10, 1);

      expect(change).toEqual({ id: grant.id, startDate: "2026-08-21" });
      expect(occurrencesInPeriod(grant, currentBudgetPeriod(TODAY, 1))).toEqual(
        occurrencesInPeriod(
          { ...grant, startDate: isoDate("2026-08-21") },
          currentBudgetPeriod(TODAY, 1),
        ),
      );
    });

    it("every 2 months: moved back by whole 2-month steps, keeping which months", () => {
      const insurance = rule("EXPENSE", "2026-09-10", { interval: 2 });

      expect(rebase([insurance], 10, 1)).toEqual([{ id: insurance.id, startDate: "2026-07-10" }]);
    });

    it("yearly (possible through the API): moved back by whole years, keeping the month", () => {
      const insurance = rule("EXPENSE", "2026-09-10", { frequency: "YEARLY" });

      expect(rebase([insurance], 10, 1)).toEqual([{ id: insurance.id, startDate: "2025-09-10" }]);
    });

    it("inactive rules move too, so switching one back on counts it right", () => {
      const paused = { ...rule("EXPENSE", "2026-09-10"), isActive: false };

      expect(rebase([paused], 10, 1)).toEqual([{ id: paused.id, startDate: "2026-09-01" }]);
    });
  });

  describe("the period starts later: nothing to move, nothing lost or doubled", () => {
    it("1 → 10: 1.09–30.09 becomes 10.09–9.10", () => {
      const rent = rule("EXPENSE", "2026-09-01");
      const salary = rule("INCOME", "2026-09-01", { dayOfMonth: 10 });

      expect(rebase([rent, salary], 1, 10)).toEqual([]);
    });

    it("an earlier payday can still start the period later: 25 → 20 on 23.09 (25.08 → 20.09)", () => {
      const rent = rule("EXPENSE", "2026-08-25");

      expect(rebase([rent], 25, 20)).toEqual([]);
    });

    it("the same payday changes nothing", () => {
      expect(rebase([rule("EXPENSE", "2026-09-10")], 10, 10)).toEqual([]);
    });
  });

  it("a later payday can start the period earlier: 5 → 20 on 5.09 (5.09 → 20.08)", () => {
    const rent = rule("EXPENSE", "2026-09-05", { dayOfMonth: 1 });
    const today = isoDate("2026-09-05");

    expect(rebase([rent], 5, 20, { today, onboardedOn: today })).toEqual([
      { id: rent.id, startDate: "2026-08-20" },
    ]);
  });

  it("back and forth (10 → 1 → 10) ends where it began: every payment once", () => {
    const rent = rule("EXPENSE", "2026-09-10");
    const moved = { ...rent, startDate: startOf(rent, rebase([rent], 10, 1)) };

    expect(rebase([moved], 1, 10)).toEqual([]);
    expect(occurrencesInPeriod(moved, currentBudgetPeriod(TODAY, 10))).toEqual(
      occurrencesInPeriod(rent, currentBudgetPeriod(TODAY, 10)),
    );
  });

  describe("end of month", () => {
    const today = isoDate("2026-09-30");

    it("28 → 1 on 30.09 (28.09–27.10 becomes 1.09–30.09): rent on the 31st is paid on the 30th", () => {
      const rent = rule("EXPENSE", "2026-09-28", { dayOfMonth: 31 });
      const [change] = rebase([rent], 28, 1, { today, onboardedOn: today });

      expect(change).toEqual({ id: rent.id, startDate: "2026-09-01" });
      expect(
        occurrencesInPeriod(
          { ...rent, startDate: isoDate("2026-09-01") },
          currentBudgetPeriod(today, 1),
        ),
      ).toEqual(["2026-09-30"]);
    });

    it("28 → 27 on 30.09: one day earlier", () => {
      const rent = rule("EXPENSE", "2026-09-28");

      expect(rebase([rent], 28, 27, { today, onboardedOn: today })).toEqual([
        { id: rent.id, startDate: "2026-09-27" },
      ]);
    });
  });

  describe("leap year (29.02.2028, 28 → 1: 28.02–27.03 becomes 1.02–29.02)", () => {
    const today = isoDate("2028-02-29");
    const leap = (rules: RebasedRule[]) => rebase(rules, 28, 1, { today, onboardedOn: today });

    it("monthly", () => {
      const salary = rule("INCOME", "2028-02-28", { dayOfMonth: 28 });

      expect(leap([salary])).toEqual([{ id: salary.id, startDate: "2028-02-01" }]);
    });

    it("every 2 weeks: 25.02 → 11.02 → 28.01", () => {
      const grant = rule("INCOME", "2028-02-25", {
        frequency: "WEEKLY",
        interval: 2,
        dayOfMonth: null,
        dayOfWeek: 5,
      });

      expect(leap([grant])).toEqual([{ id: grant.id, startDate: "2028-01-28" }]);
    });

    it("every 2 months: 28.02.2028 → 28.12.2027", () => {
      const insurance = rule("EXPENSE", "2028-02-28", { interval: 2 });

      expect(leap([insurance])).toEqual([{ id: insurance.id, startDate: "2027-12-28" }]);
    });
  });

  it("before onboarding (no date) no commitment moves; incomes still do", () => {
    const rent = rule("EXPENSE", "2026-09-10");
    const salary = rule("INCOME", "2026-09-10");

    expect(rebase([rent, salary], 10, 1, { onboardedOn: null })).toEqual([
      { id: salary.id, startDate: "2026-09-01" },
    ]);
  });
});
