import { categorySchema, createCategorySchema } from "@vireo/shared";

import { toCategory } from "../src/categories/categories.service.js";
import { OTHER_CATEGORY_ID } from "../src/categories/system-category-ids.js";
import { SYSTEM_CATEGORIES } from "./system-categories.js";

// Seed pisze prosto do bazy, z pominięciem walidacji na granicy API. Te testy
// przepuszczają jego dane przez te same schematy, przez które przechodzą
// odpowiedzi API i dane od użytkownika — inaczej błąd wychodzi dopiero jako
// 500 na produkcji (tak było z id 'cat-jedzenie').
describe("dane z seeda przechodzą przez schematy API", () => {
  const rows = SYSTEM_CATEGORIES.map((category) => ({
    ...category,
    userId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  it.each(rows.map((row) => [row.name, row] as const))(
    "%s: odpowiedź GET /categories jest zgodna z categorySchema",
    (_name, row) => {
      // parse, nie safeParse: przy błędzie widać, które pole nie przeszło.
      expect(categorySchema.parse(toCategory(row))).toEqual({ ...toCategory(row), isSystem: true });
    },
  );

  it.each(SYSTEM_CATEGORIES.map((category) => [category.name, category] as const))(
    "%s: spełnia te same reguły co kategoria zakładana przez użytkownika",
    (_name, { name, icon, color }) => {
      expect(createCategorySchema.parse({ name, icon, color })).toEqual({ name, icon, color });
    },
  );

  it("id i nazwy są unikalne", () => {
    expect(new Set(SYSTEM_CATEGORIES.map((c) => c.id)).size).toBe(SYSTEM_CATEGORIES.length);
    expect(new Set(SYSTEM_CATEGORIES.map((c) => c.name)).size).toBe(SYSTEM_CATEGORIES.length);
  });

  it("onboarding zapisuje „Wydatki przed Finso” w kategorii Inne — jej id jest w src", () => {
    expect(SYSTEM_CATEGORIES.find((c) => c.id === OTHER_CATEGORY_ID)?.name).toBe("Inne");
  });
});
