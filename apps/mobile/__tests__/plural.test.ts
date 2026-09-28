import { plural } from "../src/format/plural";

const days = { one: "dzień", few: "dni", many: "dni" };
const goals = { one: "kolejny cel", few: "kolejne cele", many: "kolejnych celów" };

// Polish: 1 → one; 2–4, 22–24, 32–34… → few; the rest (incl. 0, 5–21, 12–14) → many.
it.each([
  [1, goals.one],
  [2, goals.few],
  [4, goals.few],
  [22, goals.few],
  [0, goals.many],
  [5, goals.many],
  [12, goals.many],
  [14, goals.many],
  [21, goals.many],
  [25, goals.many],
  [112, goals.many],
])("%i → %s", (count, expected) => {
  expect(plural(count, goals)).toBe(expected);
});

it("works for days too", () => {
  expect(plural(1, days)).toBe("dzień");
  expect(plural(12, days)).toBe("dni");
});
