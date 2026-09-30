import { describe, expect, it } from "vitest";

import {
  createIncomeSourceSchema,
  incomeSourceSchema,
  updateIncomeSourceSchema,
} from "./schemas.js";

const RULE_ID = "01a0cf55-89a0-7159-b809-6b5abf846e15";

const monthly = { frequency: "MONTHLY", startDate: "2026-09-10", dayOfMonth: 10 } as const;
const biweekly = {
  frequency: "WEEKLY",
  interval: 2,
  startDate: "2026-09-04",
  dayOfWeek: 5,
} as const;
const salary = { name: "Pensja", kind: "REGULAR", expectedAmount: 800_000 } as const;

/** Ścieżki i komunikaty błędów, np. "schedule.dayOfMonth:required_for_monthly_and_yearly". */
function issues(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return (result.error?.issues ?? []).map(
    (issue) => `${issue.path.map(String).join(".")}:${issue.message}`,
  );
}

describe("harmonogram źródła dochodu (`schedule`)", () => {
  describe("POST /income/sources", () => {
    it("domyślnie brak harmonogramu", () => {
      expect(createIncomeSourceSchema.parse(salary).schedule).toBeNull();
    });

    it("co miesiąc z dniem; interval domyślnie 1, dayOfWeek null", () => {
      expect(createIncomeSourceSchema.parse({ ...salary, schedule: monthly }).schedule).toEqual({
        ...monthly,
        interval: 1,
        dayOfWeek: null,
      });
    });

    it("co 2 tygodnie z dniem tygodnia", () => {
      expect(createIncomeSourceSchema.parse({ ...salary, schedule: biweekly }).schedule).toEqual({
        ...biweekly,
        dayOfMonth: null,
      });
    });

    it("te same reguły spójności co w regule: miesięczny wymaga dnia miesiąca", () => {
      const result = createIncomeSourceSchema.safeParse({
        ...salary,
        schedule: { frequency: "MONTHLY", startDate: "2026-09-10" },
      });

      expect(issues(result)).toEqual(["schedule.dayOfMonth:required_for_monthly_and_yearly"]);
    });

    it("tygodniowy wymaga dnia tygodnia i nie przyjmuje dnia miesiąca", () => {
      const result = createIncomeSourceSchema.safeParse({
        ...salary,
        schedule: { frequency: "WEEKLY", startDate: "2026-09-04", dayOfMonth: 4 },
      });

      expect(issues(result)).toEqual([
        "schedule.dayOfWeek:required_for_weekly",
        "schedule.dayOfMonth:not_allowed_for_weekly",
      ]);
    });

    it("dochód nieregularny nie ma harmonogramu — liczy się z wpływów", () => {
      const result = createIncomeSourceSchema.safeParse({
        name: "Zlecenia",
        kind: "IRREGULAR",
        schedule: monthly,
      });

      expect(issues(result)).toEqual(["schedule:not_allowed_for_irregular"]);
    });

    it("harmonogram albo istniejąca reguła, nie oba naraz", () => {
      const result = createIncomeSourceSchema.safeParse({
        ...salary,
        schedule: monthly,
        recurringRuleId: RULE_ID,
      });

      expect(issues(result)).toEqual(["schedule:conflicts_with_recurring_rule_id"]);
    });
  });

  describe("PATCH /income/sources/:id", () => {
    it("bez `schedule` — harmonogram bez zmian (pole nie pojawia się po parsowaniu)", () => {
      expect(updateIncomeSourceSchema.parse({ name: "Wypłata" })).toEqual({ name: "Wypłata" });
    });

    it("`schedule: null` odpina harmonogram", () => {
      expect(updateIncomeSourceSchema.parse({ schedule: null })).toEqual({ schedule: null });
    });

    it("nowy harmonogram przechodzi tę samą walidację", () => {
      expect(updateIncomeSourceSchema.safeParse({ schedule: biweekly }).success).toBe(true);
      expect(
        issues(
          updateIncomeSourceSchema.safeParse({
            schedule: { frequency: "WEEKLY", startDate: "2026-09-04" },
          }),
        ),
      ).toEqual(["schedule.dayOfWeek:required_for_weekly"]);
    });

    it("harmonogram i recurringRuleId naraz to błąd", () => {
      expect(
        issues(updateIncomeSourceSchema.safeParse({ schedule: monthly, recurringRuleId: RULE_ID })),
      ).toEqual(["schedule:conflicts_with_recurring_rule_id"]);
    });
  });

  it("odpowiedź API niesie harmonogram, żeby appka nie musiała pobierać reguł", () => {
    const source = {
      id: RULE_ID,
      ...salary,
      recurringRuleId: RULE_ID,
      isActive: true,
      schedule: { ...monthly, interval: 1, dayOfWeek: null },
    };

    expect(incomeSourceSchema.parse(source)).toEqual(source);
    expect(incomeSourceSchema.safeParse({ ...source, schedule: undefined }).success).toBe(false);
  });
});
