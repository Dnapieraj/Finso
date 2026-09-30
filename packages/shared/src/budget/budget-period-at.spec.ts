import { describe, expect, it } from "vitest";

import { isoDate } from "../date.js";
import { budgetPeriodAt, currentBudgetPeriod } from "./period.js";

const d = isoDate;

describe("budgetPeriodAt — okres przesunięty o N okresów od bieżącego", () => {
  it("0 to bieżący okres", () => {
    expect(budgetPeriodAt(d("2026-09-28"), 10, 0)).toEqual(
      currentBudgetPeriod(d("2026-09-28"), 10),
    );
  });

  it("-1 to poprzedni: 10.08–9.09 przed 10.09–9.10", () => {
    expect(budgetPeriodAt(d("2026-09-28"), 10, -1)).toEqual({
      start: "2026-08-10",
      end: "2026-09-09",
    });
  });

  it("+1 to następny", () => {
    expect(budgetPeriodAt(d("2026-09-28"), 10, 1)).toEqual({
      start: "2026-10-10",
      end: "2026-11-09",
    });
  });

  it("przed dniem wypłaty bieżący okres zaczął się w poprzednim miesiącu, więc -1 cofa się dalej", () => {
    // 5.09 przy wypłacie 10.: bieżący 10.08–9.09, poprzedni 10.07–9.08.
    expect(budgetPeriodAt(d("2026-09-05"), 10, -1)).toEqual({
      start: "2026-07-10",
      end: "2026-08-09",
    });
  });

  it("przez przełom roku: grudzień przed styczniem", () => {
    expect(budgetPeriodAt(d("2027-01-15"), 1, -1)).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
    });
  });

  it("rok przestępny: luty 2028 ma 29 dni", () => {
    expect(budgetPeriodAt(d("2028-03-15"), 1, -1)).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
  });

  it("dzień wypłaty 28.: okres kończy się 27. także w lutym", () => {
    expect(budgetPeriodAt(d("2028-03-15"), 28, -1)).toEqual({
      start: "2028-01-28",
      end: "2028-02-27",
    });
  });

  it("-12 to ten sam okres rok wcześniej", () => {
    expect(budgetPeriodAt(d("2026-09-28"), 10, -12)).toEqual({
      start: "2025-09-10",
      end: "2025-10-09",
    });
  });
});
