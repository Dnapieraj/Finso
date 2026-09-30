import { describe, expect, it } from "vitest";

import { isoDate } from "../date.js";
import { ruleStartDate } from "./rule-start-date.js";
import type { BudgetPeriod } from "./types.js";

const MONDAY = 1;
const FRIDAY = 5;
const SUNDAY = 0;

/** Okres od 10.09 do 9.10; „dziś” to poniedziałek 28.09.2026. */
const period: BudgetPeriod = { start: isoDate("2026-09-10"), end: isoDate("2026-10-09") };
const today = isoDate("2026-09-28");

describe("ruleStartDate", () => {
  describe("co miesiąc i co tydzień", () => {
    it.each(["MONTHLY", "WEEKLY"] as const)(
      "%s: dochód liczy się od początku okresu — wypłata sprzed dziś też jest dochodem tego okresu",
      (cadence) => {
        const input =
          cadence === "MONTHLY"
            ? ({ cadence } as const)
            : ({ cadence, dayOfWeek: FRIDAY } as const);

        expect(ruleStartDate({ ...input, kind: "INCOME", today, period })).toBe("2026-09-10");
      },
    );

    it.each(["MONTHLY", "WEEKLY"] as const)(
      "%s: zobowiązanie liczy się od dziś — zapłacone wcześniej jest już w wydatkach",
      (cadence) => {
        const input =
          cadence === "MONTHLY"
            ? ({ cadence } as const)
            : ({ cadence, dayOfWeek: FRIDAY } as const);

        expect(ruleStartDate({ ...input, kind: "EXPENSE", today, period })).toBe("2026-09-28");
      },
    );
  });

  describe("co 2 tygodnie: zobowiązanie od najbliższej płatności", () => {
    const biweekly = (dayOfWeek: number, week: "this" | "next", on = today) =>
      ruleStartDate({ kind: "EXPENSE", cadence: "BIWEEKLY", dayOfWeek, week, today: on, period });

    it("piątek w tym tygodniu", () => {
      expect(biweekly(FRIDAY, "this")).toBe("2026-10-02");
    });

    it("piątek w przyszłym tygodniu", () => {
      expect(biweekly(FRIDAY, "next")).toBe("2026-10-09");
    });

    it("dzień płatności dziś liczy się jako najbliższy", () => {
      expect(biweekly(MONDAY, "this")).toBe("2026-09-28");
    });

    it("tydzień zaczyna się w poniedziałek: niedziela to koniec tego tygodnia", () => {
      expect(biweekly(SUNDAY, "this")).toBe("2026-10-04");
    });

    it("dzień z tego tygodnia już minął: najbliższa płatność za 2 tygodnie od niego", () => {
      // Czwartek 1.10; poniedziałek 28.09 minął → 12.10.
      expect(biweekly(MONDAY, "this", isoDate("2026-10-01"))).toBe("2026-10-12");
    });

    it("zmiana czasu (25.10) nie przesuwa daty o dzień", () => {
      // Czwartek 22.10; poniedziałek 19.10 minął → 2.11, po zmianie czasu.
      expect(biweekly(MONDAY, "this", isoDate("2026-10-22"))).toBe("2026-11-02");
    });

    it("rok przestępny: przez 29 lutego", () => {
      // Czwartek 24.02.2028; poniedziałek 21.02 minął → 6.03 (luty ma 29 dni).
      expect(biweekly(MONDAY, "this", isoDate("2028-02-24"))).toBe("2028-03-06");
    });
  });

  describe("co 2 tygodnie: dochód z tą samą fazą, ale od początku okresu", () => {
    const biweekly = (week: "this" | "next", within: BudgetPeriod = period) =>
      ruleStartDate({
        kind: "INCOME",
        cadence: "BIWEEKLY",
        dayOfWeek: FRIDAY,
        week,
        today,
        period: within,
      });

    it("piątek w tym tygodniu (2.10): cofnięty co 14 dni do 4.09 — wpływ z 18.09 też się liczy", () => {
      expect(biweekly("this")).toBe("2026-09-04");
    });

    it("piątek w przyszłym tygodniu (9.10): faza 25.09, 11.09 → start 28.08", () => {
      expect(biweekly("next")).toBe("2026-08-28");
    });

    it("płatność dokładnie w dniu startu okresu zostaje startem", () => {
      const fromEleventh = { start: isoDate("2026-09-11"), end: isoDate("2026-10-10") };

      expect(biweekly("next", fromEleventh)).toBe("2026-09-11");
    });
  });
});
