import { describe, expect, it } from "vitest";

import {
  createRecurringRuleSchema,
  recurringRuleShapeSchema,
  updateRecurringRuleSchema,
} from "./schemas.js";

const monthlyExpense = {
  kind: "EXPENSE",
  name: "Czynsz",
  frequency: "MONTHLY",
  startDate: "2026-09-10",
  dayOfMonth: 10,
  expectedAmount: 250_000,
} as const;

const issuesOf = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => (result.error?.issues ?? []).map((i) => `${i.path.join(".")}:${i.message}`);

describe("createRecurringRuleSchema", () => {
  it("przyjmuje miesięczny wydatek i uzupełnia wartości domyślne", () => {
    expect(createRecurringRuleSchema.parse(monthlyExpense)).toEqual({
      ...monthlyExpense,
      interval: 1,
      dayOfWeek: null,
      categoryId: null,
    });
  });

  it("przyjmuje tygodniowy dochód co 2 tygodnie", () => {
    const result = createRecurringRuleSchema.safeParse({
      kind: "INCOME",
      frequency: "WEEKLY",
      interval: 2,
      startDate: "2026-09-04",
      dayOfWeek: 5,
    });
    expect(result.success).toBe(true);
  });

  it("WEEKLY wymaga dayOfWeek i nie przyjmuje dayOfMonth", () => {
    const result = createRecurringRuleSchema.safeParse({
      ...monthlyExpense,
      frequency: "WEEKLY",
    });
    expect(issuesOf(result)).toEqual([
      "dayOfWeek:required_for_weekly",
      "dayOfMonth:not_allowed_for_weekly",
    ]);
  });

  it("MONTHLY/YEARLY wymagają dayOfMonth i nie przyjmują dayOfWeek", () => {
    const result = createRecurringRuleSchema.safeParse({
      ...monthlyExpense,
      frequency: "YEARLY",
      dayOfMonth: null,
      dayOfWeek: 1,
    });
    expect(issuesOf(result)).toEqual([
      "dayOfMonth:required_for_monthly_and_yearly",
      "dayOfWeek:not_allowed_for_monthly_and_yearly",
    ]);
  });

  it("wydatek bez kwoty jest odrzucany — nie ma czego odjąć z budżetu", () => {
    const result = createRecurringRuleSchema.safeParse({ ...monthlyExpense, expectedAmount: null });
    expect(issuesOf(result)).toEqual(["expectedAmount:required_for_expense"]);
  });

  it("wydatek bez nazwy jest odrzucany — to ją użytkownik widzi na liście", () => {
    const { name: _name, ...unnamed } = monthlyExpense;
    const result = createRecurringRuleSchema.safeParse(unnamed);
    expect(issuesOf(result)).toEqual(["name:required_for_expense"]);
  });

  it("dochód nie wymaga nazwy — nazwę ma podpięte źródło dochodu", () => {
    const result = createRecurringRuleSchema.safeParse({
      kind: "INCOME",
      frequency: "MONTHLY",
      startDate: "2026-01-10",
      dayOfMonth: 10,
    });
    expect(result.success).toBe(true);
  });

  it("dochód nie może mieć kategorii", () => {
    const result = createRecurringRuleSchema.safeParse({
      ...monthlyExpense,
      kind: "INCOME",
      categoryId: "01a0cf55-89a0-7159-b809-6b5abf846e15",
    });
    expect(issuesOf(result)).toEqual(["categoryId:not_allowed_for_income"]);
  });
});

describe("updateRecurringRuleSchema", () => {
  it("nie uzupełnia wartości domyślnych — PATCH zmienia tylko podane pola", () => {
    expect(updateRecurringRuleSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });

  it("nie pozwala zmienić rodzaju reguły", () => {
    expect(updateRecurringRuleSchema.parse({ kind: "INCOME" })).toEqual({});
  });
});

describe("recurringRuleShapeSchema", () => {
  it("PATCH name: null na regule wydatku jest odrzucany", () => {
    const merged = {
      kind: "EXPENSE",
      name: null,
      frequency: "MONTHLY",
      dayOfMonth: 10,
      dayOfWeek: null,
      expectedAmount: 100,
      categoryId: null,
    };
    expect(recurringRuleShapeSchema.safeParse(merged).success).toBe(false);
  });

  it("waliduje stan po scaleniu PATCH ze stanem z bazy", () => {
    // W bazie: MONTHLY z dayOfMonth. PATCH: frequency=WEEKLY, bez dayOfWeek.
    const merged = {
      kind: "EXPENSE",
      name: "Czynsz",
      frequency: "WEEKLY",
      dayOfMonth: 10,
      dayOfWeek: null,
      expectedAmount: 100,
      categoryId: null,
    };
    expect(recurringRuleShapeSchema.safeParse(merged).success).toBe(false);
  });
});
