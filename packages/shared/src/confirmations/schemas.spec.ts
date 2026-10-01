import { describe, expect, it } from "vitest";

import { answerConfirmationSchema, dueConfirmationListSchema } from "./schemas.js";

const ruleId = "01923b6e-0000-7000-8000-000000000031";
const sourceId = "01923b6e-0000-7000-8000-000000000032";

const expense = (body: object = {}) =>
  answerConfirmationSchema.safeParse({
    kind: "EXPENSE",
    recurringRuleId: ruleId,
    occurrenceDate: "2026-09-10",
    answer: "CONFIRMED",
    ...body,
  });
const income = (body: object = {}) =>
  answerConfirmationSchema.safeParse({
    kind: "INCOME",
    incomeSourceId: sourceId,
    occurrenceDate: "2026-09-10",
    answer: "CONFIRMED",
    ...body,
  });

describe("answerConfirmationSchema", () => {
  it("płatność: Tak, Inna kwota, Jeszcze nie, Nie w tym okresie", () => {
    expect(expense().success).toBe(true);
    expect(expense({ amount: 160_000 }).success).toBe(true);
    expect(expense({ answer: "NOT_YET" }).success).toBe(true);
    expect(expense({ answer: "SKIPPED" }).success).toBe(true);
  });

  it("wpływ: Tak, Inna kwota, Jeszcze nie — bez „Nie w tym okresie”", () => {
    expect(income().success).toBe(true);
    expect(income({ amount: 470_000 }).success).toBe(true);
    expect(income({ answer: "NOT_YET" }).success).toBe(true);
    expect(income({ answer: "SKIPPED" }).success).toBe(false);
  });

  it("kwota tylko przy potwierdzeniu, dodatnia i w groszach", () => {
    expect(expense({ answer: "NOT_YET", amount: 150_000 }).success).toBe(false);
    expect(expense({ answer: "SKIPPED", amount: 150_000 }).success).toBe(false);
    expect(expense({ amount: 0 }).success).toBe(false);
    expect(expense({ amount: 99.5 }).success).toBe(false);
  });

  it("id pasuje do rodzaju: płatność z regułą, wpływ ze źródłem", () => {
    expect(expense({ recurringRuleId: undefined, incomeSourceId: sourceId }).success).toBe(false);
    expect(income({ incomeSourceId: undefined, recurringRuleId: ruleId }).success).toBe(false);
  });

  it("termin to prawdziwa data kalendarzowa", () => {
    expect(expense({ occurrenceDate: "2026-02-30" }).success).toBe(false);
  });
});

describe("dueConfirmationListSchema", () => {
  it("przyjmuje listę z API", () => {
    expect(
      dueConfirmationListSchema.parse([
        {
          kind: "EXPENSE",
          id: ruleId,
          label: "Czynsz",
          occurrenceDate: "2026-09-10",
          expectedAmount: 150_000,
          askToday: true,
          overdue: false,
        },
      ]),
    ).toHaveLength(1);
  });
});
