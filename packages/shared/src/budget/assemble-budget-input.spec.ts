import { describe, expect, it } from "vitest";

import { isoDate } from "../date.js";
import { grosze } from "../money.js";
import type {
  BudgetExpenseRule,
  BudgetIncomeSource,
  BudgetSnapshot,
} from "./assemble-budget-input.js";
import { assembleBudgetInput } from "./assemble-budget-input.js";
import { calculateAvailableBalance } from "./calculate-available-balance.js";
import type { RecurrenceSchedule } from "./recurrence.js";

const d = isoDate;
const g = grosze;

/** Pusty stan: nowy użytkownik tuż po rejestracji. Okres = wrzesień 2026. */
function snapshot(overrides: Partial<BudgetSnapshot> = {}): BudgetSnapshot {
  return {
    today: d("2026-09-23"),
    periodStartDay: 1,
    incomeSources: [],
    incomeEntries: [],
    expenseRules: [],
    transactions: [],
    goals: [],
    ...overrides,
  };
}

/**
 * Reguły od 1.09, czyli od początku okresu z testów: nieodpowiedziane
 * terminy z wcześniejszych okresów byłyby zaległe (patrz osobne testy).
 */
const monthlyOn = (dayOfMonth: number): RecurrenceSchedule => ({
  frequency: "MONTHLY",
  interval: 1,
  startDate: d("2026-09-01"),
  dayOfMonth,
  dayOfWeek: null,
});

/** Co 2 tygodnie w piątek — we wrześniu 2026: 4.09 i 18.09. */
const biweeklyFriday: RecurrenceSchedule = {
  frequency: "WEEKLY",
  interval: 2,
  startDate: d("2026-09-01"),
  dayOfMonth: null,
  dayOfWeek: 5,
};

const salary = (overrides: Partial<BudgetIncomeSource> = {}): BudgetIncomeSource => ({
  id: "salary",
  name: "Pensja",
  kind: "REGULAR",
  expectedAmount: g(800_000),
  isActive: true,
  schedule: monthlyOn(10),
  ...overrides,
});

const rent = (overrides: Partial<BudgetExpenseRule> = {}): BudgetExpenseRule => ({
  id: "rent",
  label: "Czynsz",
  expectedAmount: g(250_000),
  isActive: true,
  schedule: monthlyOn(10),
  ...overrides,
});

describe('assembleBudgetInput — okres i "dziś"', () => {
  it("pusta historia (nowy użytkownik): zerowy dochód, zero zobowiązań, zero wydatków", () => {
    expect(assembleBudgetInput(snapshot())).toEqual({
      period: { start: "2026-09-01", end: "2026-09-30" },
      asOf: "2026-09-23",
      periodIncome: 0,
      remainingFixedCommitments: [],
      goalContributions: [],
      alreadySpent: 0,
      goals: [],
    });
  });

  it("okres wynika z periodStartDay", () => {
    const input = assembleBudgetInput(snapshot({ periodStartDay: 10 }));
    expect(input.period).toEqual({ start: "2026-09-10", end: "2026-10-09" });
  });
});

describe("assembleBudgetInput — periodIncome", () => {
  it("REGULAR bez potwierdzonego wpływu → oczekiwana kwota", () => {
    const input = assembleBudgetInput(snapshot({ incomeSources: [salary()] }));
    expect(input.periodIncome).toBe(800_000);
  });

  it("REGULAR z potwierdzonym wpływem → faktyczna kwota zamiast oczekiwanej", () => {
    const input = assembleBudgetInput(
      snapshot({
        incomeSources: [salary()],
        incomeEntries: [
          {
            incomeSourceId: "salary",
            amount: g(760_000),
            date: d("2026-09-10"),
            status: "CONFIRMED",
          },
        ],
      }),
    );
    expect(input.periodIncome).toBe(760_000);
  });

  it("REGULAR co 2 tygodnie: jedna wypłata potwierdzona, druga jeszcze oczekiwana", () => {
    const input = assembleBudgetInput(
      snapshot({
        incomeSources: [salary({ expectedAmount: g(300_000), schedule: biweeklyFriday })],
        incomeEntries: [
          {
            incomeSourceId: "salary",
            amount: g(310_000),
            date: d("2026-09-04"),
            status: "CONFIRMED",
          },
        ],
      }),
    );
    // 310 000 faktycznie + 300 000 za 18.09, która jeszcze nie przyszła.
    expect(input.periodIncome).toBe(610_000);
  });

  it("REGULAR bez harmonogramu → oczekiwana kwota raz na okres", () => {
    const input = assembleBudgetInput(snapshot({ incomeSources: [salary({ schedule: null })] }));
    expect(input.periodIncome).toBe(800_000);
  });

  it("więcej potwierdzonych wpływów niż wystąpień (np. premia) → liczy się faktyczna suma", () => {
    const input = assembleBudgetInput(
      snapshot({
        incomeSources: [salary()],
        incomeEntries: [
          {
            incomeSourceId: "salary",
            amount: g(800_000),
            date: d("2026-09-10"),
            status: "CONFIRMED",
          },
          {
            incomeSourceId: "salary",
            amount: g(200_000),
            date: d("2026-09-20"),
            status: "CONFIRMED",
          },
        ],
      }),
    );
    expect(input.periodIncome).toBe(1_000_000);
  });

  it("IRREGULAR: tylko potwierdzone wpływy z okresu", () => {
    const input = assembleBudgetInput(
      snapshot({
        incomeSources: [
          {
            id: "gigs",
            name: "Zlecenia",
            kind: "IRREGULAR",
            expectedAmount: null,
            isActive: true,
            schedule: null,
          },
        ],
        incomeEntries: [
          {
            incomeSourceId: "gigs",
            amount: g(120_000),
            date: d("2026-09-05"),
            status: "CONFIRMED",
          },
          { incomeSourceId: "gigs", amount: g(50_000), date: d("2026-09-15"), status: "PENDING" },
          { incomeSourceId: "gigs", amount: g(90_000), date: d("2026-09-16"), status: "DECLINED" },
          {
            incomeSourceId: "gigs",
            amount: g(999_000),
            date: d("2026-08-31"),
            status: "CONFIRMED",
          },
        ],
      }),
    );
    expect(input.periodIncome).toBe(120_000);
  });

  it("zarchiwizowane źródło: bez oczekiwanej kwoty, ale potwierdzony wpływ się liczy", () => {
    const input = assembleBudgetInput(
      snapshot({
        incomeSources: [salary({ isActive: false })],
        incomeEntries: [
          {
            incomeSourceId: "salary",
            amount: g(400_000),
            date: d("2026-09-02"),
            status: "CONFIRMED",
          },
        ],
      }),
    );
    expect(input.periodIncome).toBe(400_000);
  });
});

describe("assembleBudgetInput — remainingFixedCommitments", () => {
  it("nieopłacony czynsz trafia na listę z pełną kwotą", () => {
    const input = assembleBudgetInput(snapshot({ expenseRules: [rent()] }));
    expect(input.remainingFixedCommitments).toEqual([{ label: "Czynsz", amount: 250_000 }]);
  });

  it("opłacony czynsz (potwierdzona transakcja z tą regułą) znika z listy", () => {
    const input = assembleBudgetInput(
      snapshot({
        expenseRules: [rent()],
        transactions: [
          {
            amount: g(250_000),
            date: d("2026-09-10"),
            status: "CONFIRMED",
            recurringRuleId: "rent",
          },
        ],
      }),
    );
    expect(input.remainingFixedCommitments).toEqual([]);
    // ...i jest policzony w alreadySpent, więc nie odejmujemy go dwa razy.
    expect(input.alreadySpent).toBe(250_000);
  });

  it("transakcja PENDING nie oznacza opłacenia", () => {
    const input = assembleBudgetInput(
      snapshot({
        expenseRules: [rent()],
        transactions: [
          { amount: g(250_000), date: d("2026-09-10"), status: "PENDING", recurringRuleId: "rent" },
        ],
      }),
    );
    expect(input.remainingFixedCommitments).toEqual([{ label: "Czynsz", amount: 250_000 }]);
    expect(input.alreadySpent).toBe(0);
  });

  it("zobowiązanie tygodniowe: zostają tylko nieopłacone wystąpienia", () => {
    const gym: BudgetExpenseRule = {
      id: "gym",
      label: "Siłownia",
      expectedAmount: g(3_000),
      isActive: true,
      schedule: {
        frequency: "WEEKLY",
        interval: 1,
        startDate: d("2026-09-01"),
        dayOfMonth: null,
        dayOfWeek: 5,
      },
    };
    const input = assembleBudgetInput(
      snapshot({
        expenseRules: [gym],
        transactions: [
          { amount: g(3_000), date: d("2026-09-04"), status: "CONFIRMED", recurringRuleId: "gym" },
        ],
      }),
    );
    // 4 piątki we wrześniu, 1 opłacony → 3 × 30 zł.
    expect(input.remainingFixedCommitments).toEqual([{ label: "Siłownia", amount: 9_000 }]);
  });

  it("wyłączona reguła (anulowana subskrypcja) nie jest zobowiązaniem", () => {
    const input = assembleBudgetInput(snapshot({ expenseRules: [rent({ isActive: false })] }));
    expect(input.remainingFixedCommitments).toEqual([]);
  });

  it("opłata z poprzedniego okresu nie liczy się jako opłata w tym", () => {
    const input = assembleBudgetInput(
      snapshot({
        expenseRules: [rent()],
        transactions: [
          {
            amount: g(250_000),
            date: d("2026-08-10"),
            status: "CONFIRMED",
            recurringRuleId: "rent",
          },
        ],
      }),
    );
    expect(input.remainingFixedCommitments).toEqual([{ label: "Czynsz", amount: 250_000 }]);
    expect(input.alreadySpent).toBe(0);
  });

  it("„Nie w tym okresie” (DECLINED z terminem) zamyka czynsz, ale nic nie wydaje", () => {
    const input = assembleBudgetInput(
      snapshot({
        expenseRules: [rent()],
        transactions: [
          {
            amount: g(250_000),
            date: d("2026-09-10"),
            occurrenceDate: d("2026-09-10"),
            status: "DECLINED",
            recurringRuleId: "rent",
          },
        ],
      }),
    );
    expect(input.remainingFixedCommitments).toEqual([]);
    expect(input.alreadySpent).toBe(0);
  });

  it("zaległy czynsz potwierdzony w nowym okresie: wydany teraz, ale nie zamyka nowego terminu", () => {
    const input = assembleBudgetInput(
      snapshot({
        today: d("2026-09-12"),
        expenseRules: [rent({ schedule: { ...monthlyOn(10), startDate: d("2026-08-01") } })],
        transactions: [
          {
            amount: g(250_000),
            date: d("2026-09-02"),
            occurrenceDate: d("2026-08-10"),
            status: "CONFIRMED",
            recurringRuleId: "rent",
          },
        ],
      }),
    );
    expect(input.remainingFixedCommitments).toEqual([{ label: "Czynsz", amount: 250_000 }]);
    expect(input.alreadySpent).toBe(250_000);
  });
});

describe("assembleBudgetInput — zaległe z poprzednich okresów", () => {
  const sinceAugust = { ...monthlyOn(10), startDate: d("2026-08-01") };

  it("nieodpowiedziany czynsz z sierpnia dalej odliczany, osobną pozycją „zaległe”", () => {
    const input = assembleBudgetInput(
      snapshot({ expenseRules: [rent({ schedule: sinceAugust })] }),
    );
    expect(input.remainingFixedCommitments).toEqual([
      { label: "Czynsz", amount: 250_000, overdue: true },
      { label: "Czynsz", amount: 250_000 },
    ]);
  });

  it("dwa zaległe terminy tej samej reguły to jedna pozycja z sumą", () => {
    const input = assembleBudgetInput(
      snapshot({
        today: d("2026-10-05"),
        expenseRules: [rent({ schedule: sinceAugust })],
      }),
    );
    expect(input.remainingFixedCommitments).toEqual([
      { label: "Czynsz", amount: 500_000, overdue: true },
      { label: "Czynsz", amount: 250_000 },
    ]);
  });

  it("„Nie w tym okresie” na zaległy termin go zamyka", () => {
    const input = assembleBudgetInput(
      snapshot({
        expenseRules: [rent({ schedule: sinceAugust })],
        transactions: [
          {
            amount: g(250_000),
            date: d("2026-09-15"),
            occurrenceDate: d("2026-08-10"),
            status: "DECLINED",
            recurringRuleId: "rent",
          },
        ],
      }),
    );
    expect(input.remainingFixedCommitments).toEqual([{ label: "Czynsz", amount: 250_000 }]);
  });

  it("czynsz z sierpnia sprzed dodania reguły do Finso nie jest zaległy", () => {
    const input = assembleBudgetInput(
      snapshot({ expenseRules: [rent({ schedule: sinceAugust, trackedSince: d("2026-09-01") })] }),
    );
    expect(input.remainingFixedCommitments).toEqual([{ label: "Czynsz", amount: 250_000 }]);
  });

  it("zaległy wpływ NIE zwiększa budżetu — liczy się dopiero, gdy wpłynie", () => {
    // Bezpieczniej: pieniądze, których nie ma od miesiąca, nie są do wydania.
    const input = assembleBudgetInput(
      snapshot({ incomeSources: [salary({ schedule: sinceAugust })] }),
    );
    expect(input.periodIncome).toBe(800_000);
  });

  it("zaległy wpływ potwierdzony teraz liczy się w tym okresie", () => {
    const input = assembleBudgetInput(
      snapshot({
        incomeSources: [salary({ schedule: sinceAugust })],
        incomeEntries: [
          {
            incomeSourceId: "salary",
            amount: g(800_000),
            date: d("2026-09-15"),
            occurrenceDate: d("2026-08-10"),
            status: "CONFIRMED",
          },
        ],
      }),
    );
    // Sierpniowa wpłynęła 15.09, wrześniowa (10.09) wciąż oczekiwana.
    expect(input.periodIncome).toBe(1_600_000);
  });
});

describe("assembleBudgetInput — wpływy przypisane do terminu", () => {
  it("co 2 tygodnie: potwierdzona tylko druga wypłata — pierwsza dalej oczekiwana", () => {
    const input = assembleBudgetInput(
      snapshot({
        incomeSources: [salary({ expectedAmount: g(300_000), schedule: biweeklyFriday })],
        incomeEntries: [
          {
            incomeSourceId: "salary",
            amount: g(320_000),
            date: d("2026-09-18"),
            occurrenceDate: d("2026-09-18"),
            status: "CONFIRMED",
          },
        ],
      }),
    );
    expect(input.periodIncome).toBe(620_000);
  });

  it("wypłata „Jeszcze nie” (PENDING) liczy się jako oczekiwana, nie podwójnie", () => {
    const input = assembleBudgetInput(
      snapshot({
        incomeSources: [salary()],
        incomeEntries: [
          {
            incomeSourceId: "salary",
            amount: g(800_000),
            date: d("2026-09-11"),
            occurrenceDate: d("2026-09-10"),
            status: "PENDING",
          },
        ],
      }),
    );
    expect(input.periodIncome).toBe(800_000);
  });
});

describe("assembleBudgetInput — alreadySpent", () => {
  it("suma potwierdzonych wydatków z okresu, bez PENDING/DECLINED i spoza okresu", () => {
    const input = assembleBudgetInput(
      snapshot({
        transactions: [
          { amount: g(1_299), date: d("2026-09-01"), status: "CONFIRMED", recurringRuleId: null },
          { amount: g(5_000), date: d("2026-09-30"), status: "CONFIRMED", recurringRuleId: null },
          { amount: g(7_000), date: d("2026-09-12"), status: "PENDING", recurringRuleId: null },
          { amount: g(8_000), date: d("2026-09-12"), status: "DECLINED", recurringRuleId: null },
          { amount: g(9_000), date: d("2026-10-01"), status: "CONFIRMED", recurringRuleId: null },
        ],
      }),
    );
    expect(input.alreadySpent).toBe(6_299);
  });
});

describe("assembleBudgetInput — cele", () => {
  it("rata celu rozłożona na pozostałe okresy (zaokrąglona w górę)", () => {
    const input = assembleBudgetInput(
      snapshot({
        goals: [
          // Wrzesień, październik, listopad → 3 okresy; 100 000 / 3 → 33 334.
          {
            id: "trip",
            targetAmount: g(100_000),
            currentAmount: g(0),
            targetDate: d("2026-11-30"),
          },
        ],
      }),
    );
    expect(input.goalContributions).toEqual([{ goalId: "trip", amount: 33_334 }]);
    expect(input.goals).toEqual([
      { id: "trip", targetAmount: 100_000, currentAmount: 0, targetDate: "2026-11-30" },
    ]);
  });

  it("termin celu w przeszłości → cała brakująca kwota w tym okresie", () => {
    const input = assembleBudgetInput(
      snapshot({
        goals: [
          {
            id: "late",
            targetAmount: g(100_000),
            currentAmount: g(40_000),
            targetDate: d("2026-06-01"),
          },
        ],
      }),
    );
    expect(input.goalContributions).toEqual([{ goalId: "late", amount: 60_000 }]);
  });

  it("osiągnięty cel → rata 0", () => {
    const input = assembleBudgetInput(
      snapshot({
        goals: [
          {
            id: "done",
            targetAmount: g(100_000),
            currentAmount: g(100_000),
            targetDate: d("2027-01-01"),
          },
        ],
      }),
    );
    expect(input.goalContributions).toEqual([{ goalId: "done", amount: 0 }]);
  });
});

describe("assembleBudgetInput + calculateAvailableBalance — scenariusz całościowy", () => {
  it("ujemne saldo: wydatki ponad dochód dają ujemny dzienny limit", () => {
    const input = assembleBudgetInput(
      snapshot({
        incomeSources: [salary({ expectedAmount: g(300_000) })],
        expenseRules: [rent()],
        transactions: [
          { amount: g(100_000), date: d("2026-09-05"), status: "CONFIRMED", recurringRuleId: null },
        ],
      }),
    );
    const result = calculateAvailableBalance(input);

    // 300 000 − 250 000 (czynsz) − 100 000 (wydane) = −50 000 na 8 dni (23–30.09).
    expect(result.availableBalance).toBe(-50_000);
    expect(result.daysRemaining).toBe(8);
    expect(result.dailyAllowance).toBe(-6_250);
  });
});
