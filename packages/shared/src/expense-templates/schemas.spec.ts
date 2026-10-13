import { describe, expect, it } from "vitest";

import {
  createExpenseTemplateSchema,
  expenseTemplateSchema,
  updateExpenseTemplateSchema,
} from "./schemas.js";

const CATEGORY = "01923b6e-0000-7000-8000-000000000020";
const coffee = { name: "Kawa", amount: 1_400, categoryId: CATEGORY };

describe("createExpenseTemplateSchema", () => {
  it("przyjmuje nazwę, kwotę w groszach i kategorię; nazwę przycina", () => {
    expect(createExpenseTemplateSchema.parse({ ...coffee, name: "  Kawa  " })).toEqual(coffee);
  });

  it.each([
    ["pusta nazwa", { name: "  " }],
    ["nazwa ponad 40 znaków", { name: "x".repeat(41) }],
    ["kwota 0", { amount: 0 }],
    ["ułamek grosza", { amount: 12.5 }],
    ["brak kategorii", { categoryId: undefined }],
  ])("odrzuca: %s", (_case, change) => {
    expect(createExpenseTemplateSchema.safeParse({ ...coffee, ...change }).success).toBe(false);
  });
});

describe("updateExpenseTemplateSchema", () => {
  it("każde pole osobno, ale kategorii nie da się wyczyścić", () => {
    expect(updateExpenseTemplateSchema.parse({ amount: 1_600 })).toEqual({ amount: 1_600 });
    expect(updateExpenseTemplateSchema.safeParse({ categoryId: null }).success).toBe(false);
  });
});

describe("expenseTemplateSchema", () => {
  it("kategoria może być pusta, gdy ją usunięto", () => {
    const template = { id: "01923b6e-0000-7000-8000-000000000060", ...coffee, categoryId: null };

    expect(expenseTemplateSchema.parse(template)).toEqual(template);
  });
});
