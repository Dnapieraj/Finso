import { describe, expect, it } from "vitest";

import { isoDate } from "../date.js";
import { grosze } from "../money.js";
import type {
  BudgetExpenseRule,
  BudgetIncomeEntry,
  BudgetIncomeSource,
  BudgetSnapshot,
  BudgetTransaction,
} from "./assemble-budget-input.js";
import { awaitingIncome, dueConfirmations } from "./confirmations.js";
import type { RecurrenceSchedule } from "./recurrence.js";

const d = isoDate;
const g = grosze;

/** Okres 10.09–9.10 (wypłata 10.), dziś 10.09 — dzień wypłaty i czynszu. */
function snapshot(overrides: Partial<BudgetSnapshot> = {}): BudgetSnapshot {
  return {
    today: d("2026-09-10"),
    periodStartDay: 10,
    incomeSources: [],
    incomeEntries: [],
    expenseRules: [],
    transactions: [],
    goals: [],
    ...overrides,
  };
}

/** Reguły od 1.09 — wcześniejsze terminy nie istnieją, więc nic nie jest zaległe. */
const monthlyOn = (dayOfMonth: number): RecurrenceSchedule => ({
  frequency: "MONTHLY",
  interval: 1,
  startDate: d("2026-09-01"),
  dayOfMonth,
  dayOfWeek: null,
});

/** Co 2 tygodnie w piątek — w okresie 10.09–9.10: 18.09 i 2.10. */
const biweeklyFriday: RecurrenceSchedule = {
  frequency: "WEEKLY",
  interval: 2,
  startDate: d("2026-09-18"),
  dayOfMonth: null,
  dayOfWeek: 5,
};

const salary = (overrides: Partial<BudgetIncomeSource> = {}): BudgetIncomeSource => ({
  id: "salary",
  name: "Pensja",
  kind: "REGULAR",
  expectedAmount: g(500_000),
  isActive: true,
  schedule: monthlyOn(10),
  ...overrides,
});

const rent = (overrides: Partial<BudgetExpenseRule> = {}): BudgetExpenseRule => ({
  id: "rent",
  label: "Czynsz",
  expectedAmount: g(150_000),
  isActive: true,
  schedule: monthlyOn(10),
  ...overrides,
});

const entry = (overrides: Partial<BudgetIncomeEntry> = {}): BudgetIncomeEntry => ({
  incomeSourceId: "salary",
  amount: g(500_000),
  date: d("2026-09-10"),
  occurrenceDate: d("2026-09-10"),
  status: "CONFIRMED",
  ...overrides,
});

const payment = (overrides: Partial<BudgetTransaction> = {}): BudgetTransaction => ({
  amount: g(150_000),
  date: d("2026-09-10"),
  occurrenceDate: d("2026-09-10"),
  status: "CONFIRMED",
  recurringRuleId: "rent",
  ...overrides,
});

const salaryDue = {
  kind: "INCOME",
  id: "salary",
  label: "Pensja",
  occurrenceDate: "2026-09-10",
  expectedAmount: 500_000,
  askToday: true,
  overdue: false,
} as const;

const rentDue = {
  kind: "EXPENSE",
  id: "rent",
  label: "Czynsz",
  occurrenceDate: "2026-09-10",
  expectedAmount: 150_000,
  askToday: true,
  overdue: false,
} as const;

describe("dueConfirmations — co appka pyta dziś", () => {
  it("pusta historia: nic do potwierdzenia", () => {
    expect(dueConfirmations(snapshot())).toEqual([]);
  });

  it("w dniu wypłaty i czynszu: oba, wpływ przed płatnością", () => {
    const due = dueConfirmations(snapshot({ incomeSources: [salary()], expenseRules: [rent()] }));
    expect(due).toEqual([salaryDue, rentDue]);
  });

  it("przed terminem nie pyta — termin w przyszłości to jeszcze nie zaległość", () => {
    const due = dueConfirmations(
      snapshot({ incomeSources: [salary()], expenseRules: [rent({ schedule: monthlyOn(15) })] }),
    );
    expect(due).toEqual([salaryDue]);
  });

  it("dzień po terminie nadal pyta, z datą terminu", () => {
    const due = dueConfirmations(snapshot({ today: d("2026-09-12"), expenseRules: [rent()] }));
    expect(due).toEqual([rentDue]);
  });

  it("potwierdzony wpływ i opłacony czynsz znikają z listy", () => {
    const due = dueConfirmations(
      snapshot({
        incomeSources: [salary()],
        expenseRules: [rent()],
        incomeEntries: [entry({ amount: g(480_000) })],
        transactions: [payment()],
      }),
    );
    expect(due).toEqual([]);
  });

  it("„Nie w tym okresie” (DECLINED) zamyka płatność", () => {
    const due = dueConfirmations(
      snapshot({ expenseRules: [rent()], transactions: [payment({ status: "DECLINED" })] }),
    );
    expect(due).toEqual([]);
  });

  it("„Jeszcze nie” (PENDING z datą jutro): dalej na liście, ale dziś już nie pyta", () => {
    const due = dueConfirmations(
      snapshot({
        expenseRules: [rent()],
        transactions: [payment({ status: "PENDING", date: d("2026-09-11") })],
      }),
    );
    expect(due).toEqual([{ ...rentDue, askToday: false }]);
  });

  it("„Jeszcze nie” wczoraj: dziś pyta znowu", () => {
    const due = dueConfirmations(
      snapshot({
        today: d("2026-09-11"),
        expenseRules: [rent()],
        transactions: [payment({ status: "PENDING", date: d("2026-09-11") })],
      }),
    );
    expect(due).toEqual([rentDue]);
  });

  it("usunięty (w koszu) zapis nie trafia do snapshotu, więc płatność wraca na listę", () => {
    // Soft delete odfiltrowuje API — silnik widzi po prostu brak zapisu.
    const due = dueConfirmations(snapshot({ expenseRules: [rent()], transactions: [] }));
    expect(due).toEqual([rentDue]);
  });

  it("co 2 tygodnie: pierwsza wypłata potwierdzona, druga pytana dopiero w swoim dniu", () => {
    const biweekly = salary({ expectedAmount: g(250_000), schedule: biweeklyFriday });
    const confirmedFirst = entry({ date: d("2026-09-18"), occurrenceDate: d("2026-09-18") });

    expect(
      dueConfirmations(
        snapshot({
          today: d("2026-09-30"),
          incomeSources: [biweekly],
          incomeEntries: [confirmedFirst],
        }),
      ),
    ).toEqual([]);
    expect(
      dueConfirmations(
        snapshot({
          today: d("2026-10-02"),
          incomeSources: [biweekly],
          incomeEntries: [confirmedFirst],
        }),
      ),
    ).toEqual([{ ...salaryDue, occurrenceDate: "2026-10-02", expectedAmount: 250_000 }]);
  });

  it("zapis bez terminu (ręczny lub sprzed tej funkcji) zamyka najwcześniejszy otwarty termin", () => {
    const biweekly = salary({ expectedAmount: g(250_000), schedule: biweeklyFriday });
    const due = dueConfirmations(
      snapshot({
        today: d("2026-10-02"),
        incomeSources: [biweekly],
        incomeEntries: [entry({ date: d("2026-09-20"), occurrenceDate: null })],
      }),
    );
    expect(due).toEqual([{ ...salaryDue, occurrenceDate: "2026-10-02", expectedAmount: 250_000 }]);
  });

  it("wpływ potwierdzony z opóźnieniem: liczy się termin, nie dzień potwierdzenia", () => {
    const due = dueConfirmations(
      snapshot({
        today: d("2026-09-12"),
        incomeSources: [salary()],
        incomeEntries: [entry({ date: d("2026-09-12"), occurrenceDate: d("2026-09-10") })],
      }),
    );
    expect(due).toEqual([]);
  });

  it("pomija to, o co nie da się zapytać", () => {
    const due = dueConfirmations(
      snapshot({
        incomeSources: [
          salary({ id: "archived", isActive: false }),
          salary({ id: "freelance", kind: "IRREGULAR", expectedAmount: null }),
          salary({ id: "once-a-period", schedule: null }),
          salary({ id: "no-amount", expectedAmount: null }),
        ],
        expenseRules: [rent({ id: "cancelled", isActive: false })],
      }),
    );
    expect(due).toEqual([]);
  });

  it("wpływ „Jeszcze nie”: dalej na liście, dziś już nie pyta", () => {
    const due = dueConfirmations(
      snapshot({
        incomeSources: [salary()],
        incomeEntries: [entry({ status: "PENDING", date: d("2026-09-11") })],
      }),
    );
    expect(due).toEqual([{ ...salaryDue, askToday: false }]);
  });
});

describe("dueConfirmations — zaległe z poprzednich okresów", () => {
  it("nieodpowiedziany czynsz z ostatniego dnia poprzedniego okresu czeka jako zaległy", () => {
    // Czynsz 9.09 to ostatni dzień poprzedniego okresu (10.08–9.09).
    const due = dueConfirmations(snapshot({ expenseRules: [rent({ schedule: monthlyOn(9) })] }));
    expect(due).toEqual([{ ...rentDue, occurrenceDate: "2026-09-09", overdue: true }]);
  });

  it("zaległe zbierają się, dopóki nikt nie odpowie — najstarsze pierwsze", () => {
    const due = dueConfirmations(
      snapshot({
        today: d("2026-10-12"),
        expenseRules: [rent({ schedule: { ...monthlyOn(10), startDate: d("2026-08-01") } })],
      }),
    );
    expect(due.map((item) => [item.occurrenceDate, item.overdue])).toEqual([
      ["2026-08-10", true],
      ["2026-09-10", true],
      ["2026-10-10", false],
    ]);
  });

  it("odpowiedź na zaległy termin go zamyka — także „Nie w tym okresie”", () => {
    const due = dueConfirmations(
      snapshot({
        today: d("2026-10-12"),
        expenseRules: [rent({ schedule: { ...monthlyOn(10), startDate: d("2026-08-01") } })],
        transactions: [
          payment({ date: d("2026-10-11"), occurrenceDate: d("2026-08-10") }),
          payment({ status: "DECLINED", occurrenceDate: d("2026-09-10") }),
        ],
      }),
    );
    expect(due.map((item) => item.occurrenceDate)).toEqual(["2026-10-10"]);
  });

  it("zaległy wpływ też czeka (np. pensja, która przyszła po końcu okresu)", () => {
    const due = dueConfirmations(snapshot({ incomeSources: [salary({ schedule: monthlyOn(9) })] }));
    expect(due).toEqual([{ ...salaryDue, occurrenceDate: "2026-09-09", overdue: true }]);
  });

  it("terminy sprzed startu reguły nie są zaległe", () => {
    const due = dueConfirmations(
      snapshot({
        expenseRules: [rent({ schedule: { ...monthlyOn(9), startDate: d("2026-09-10") } })],
      }),
    );
    expect(due).toEqual([]);
  });

  it("terminy sprzed dodania reguły do Finso nie są zaległe — wtedy płacono bez appki", () => {
    // Reguła od sierpnia (np. start przesunięty przy zmianie dnia wypłaty),
    // ale w Finso od 5.09: sierpień nie jest zaległy, 9.09 już tak.
    const due = dueConfirmations(
      snapshot({
        expenseRules: [
          rent({
            schedule: { ...monthlyOn(9), startDate: d("2026-08-01") },
            trackedSince: d("2026-09-05"),
          }),
        ],
      }),
    );
    expect(due.map((item) => [item.occurrenceDate, item.overdue])).toEqual([["2026-09-09", true]]);
  });

  it("…to samo dla wpływów", () => {
    const due = dueConfirmations(
      snapshot({
        incomeSources: [
          salary({
            schedule: { ...monthlyOn(9), startDate: d("2026-08-01") },
            trackedSince: d("2026-09-10"),
          }),
        ],
      }),
    );
    expect(due).toEqual([]);
  });
});

describe("dueConfirmations — kolejność", () => {
  it("kolejność: po terminie, a w tym samym dniu wpływy przed płatnościami", () => {
    const due = dueConfirmations(
      snapshot({
        today: d("2026-09-20"),
        incomeSources: [salary({ schedule: monthlyOn(15) })],
        expenseRules: [rent({ id: "phone", label: "Telefon", schedule: monthlyOn(15) }), rent()],
      }),
    );
    expect(due.map((item) => [item.occurrenceDate, item.label])).toEqual([
      ["2026-09-10", "Czynsz"],
      ["2026-09-15", "Pensja"],
      ["2026-09-15", "Telefon"],
    ]);
  });
});

/**
 * Spóźniona wypłata w bieżącym okresie: budżet dalej ją liczy (to plan na
 * okres), ale Dashboard mówi wprost, ile z „Możesz wydać” jeszcze nie
 * wpłynęło. Zaległe wpływy z poprzednich okresów budżet pomija w ogóle.
 */
describe("awaitingIncome — ile z budżetu jeszcze nie wpłynęło", () => {
  it("przed dniem wypłaty: 0 — nic się nie spóźnia", () => {
    expect(awaitingIncome(snapshot({ incomeSources: [salary({ schedule: monthlyOn(15) })] }))).toBe(
      0,
    );
  });

  it("w dniu wypłaty, przed potwierdzeniem: cała oczekiwana kwota", () => {
    expect(awaitingIncome(snapshot({ incomeSources: [salary()] }))).toBe(500_000);
  });

  it("po „Jeszcze nie”: dalej cała kwota", () => {
    expect(
      awaitingIncome(
        snapshot({
          incomeSources: [salary()],
          incomeEntries: [entry({ status: "PENDING", date: d("2026-09-11") })],
        }),
      ),
    ).toBe(500_000);
  });

  it("po potwierdzeniu (także inną kwotą): 0", () => {
    expect(
      awaitingIncome(
        snapshot({ incomeSources: [salary()], incomeEntries: [entry({ amount: g(420_000) })] }),
      ),
    ).toBe(0);
  });

  it("dwa źródła spóźnione naraz: suma", () => {
    expect(
      awaitingIncome(
        snapshot({
          incomeSources: [salary(), salary({ id: "rent-out", expectedAmount: g(120_000) })],
        }),
      ),
    ).toBe(620_000);
  });

  it("zaległy wpływ z poprzedniego okresu: 0 — budżet go nie liczy", () => {
    expect(awaitingIncome(snapshot({ incomeSources: [salary({ schedule: monthlyOn(9) })] }))).toBe(
      0,
    );
  });
});
