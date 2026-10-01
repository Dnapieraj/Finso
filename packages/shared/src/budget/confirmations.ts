import type { IsoDate } from "../date.js";
import { grosze, type Grosze } from "../money.js";
import type { BudgetSnapshot } from "./assemble-budget-input.js";
import { openOccurrences, type OccurrenceRecord } from "./occurrences.js";
import { currentBudgetPeriod } from "./period.js";
import type { RecurrenceSchedule } from "./recurrence.js";

/** Termin wpływu lub stałej płatności, o który appka pyta użytkownika. */
export interface DueConfirmationLine {
  kind: "INCOME" | "EXPENSE";
  /** Id źródła dochodu (INCOME) albo reguły wydatku (EXPENSE). */
  id: string;
  label: string;
  occurrenceDate: IsoDate;
  expectedAmount: Grosze;
  /** `false` po „Jeszcze nie” — dziś już nie pytać, ale dalej pokazywać. */
  askToday: boolean;
  /** Termin z poprzedniego okresu, wciąż bez odpowiedzi. */
  overdue: boolean;
}

interface Askable {
  kind: DueConfirmationLine["kind"];
  id: string;
  label: string;
  expectedAmount: Grosze;
  schedule: RecurrenceSchedule;
  trackedSince: IsoDate | undefined;
  records: OccurrenceRecord[];
}

/**
 * Terminy do potwierdzenia na dziś: aktywne dochody stałe (z harmonogramem
 * i kwotą) i aktywne stałe płatności, których termin już minął albo jest
 * dziś, a odpowiedzi brak — z bieżącego okresu i zaległe z poprzednich.
 * Rosnąco po terminie; w tym samym dniu wpływy przed płatnościami, bo
 * pieniądze zwykle przychodzą, zanim się je wyda.
 */
export function dueConfirmations(snapshot: BudgetSnapshot): DueConfirmationLine[] {
  const period = currentBudgetPeriod(snapshot.today, snapshot.periodStartDay);
  const items: DueConfirmationLine[] = [];

  for (const item of askables(snapshot)) {
    const open = openOccurrences(
      item.schedule,
      item.records,
      period,
      snapshot.periodStartDay,
      item.trackedSince,
    );
    const dueDates = [...open.overdue, ...open.current.filter((date) => date <= snapshot.today)];
    for (const occurrenceDate of dueDates) {
      items.push({
        kind: item.kind,
        id: item.id,
        label: item.label,
        occurrenceDate,
        expectedAmount: item.expectedAmount,
        askToday: !isSnoozed(item.records, occurrenceDate, snapshot.today),
        overdue: occurrenceDate < period.start,
      });
    }
  }

  return items.sort(
    (a, b) =>
      a.occurrenceDate.localeCompare(b.occurrenceDate) || kindOrder(a.kind) - kindOrder(b.kind),
  );
}

/**
 * Ile z dochodu liczonego w budżecie bieżącego okresu jeszcze nie
 * wpłynęło: oczekiwane kwoty wpływów, których termin minął albo jest
 * dziś, a potwierdzenia brak (także po „Jeszcze nie”). Zaległe wpływy
 * z poprzednich okresów się nie liczą — budżet ich nie wlicza, dopóki
 * nie wpłyną.
 */
export function awaitingIncome(snapshot: BudgetSnapshot): Grosze {
  return grosze(
    dueConfirmations(snapshot)
      .filter((item) => item.kind === "INCOME" && !item.overdue)
      .reduce((sum, item) => sum + item.expectedAmount, 0),
  );
}

function askables(snapshot: BudgetSnapshot): Askable[] {
  const incomes = snapshot.incomeSources.flatMap((source): Askable[] =>
    source.kind === "REGULAR" &&
    source.isActive &&
    source.schedule !== null &&
    source.expectedAmount !== null
      ? [
          {
            kind: "INCOME",
            id: source.id,
            label: source.name,
            expectedAmount: source.expectedAmount,
            schedule: source.schedule,
            trackedSince: source.trackedSince,
            records: snapshot.incomeEntries.filter((entry) => entry.incomeSourceId === source.id),
          },
        ]
      : [],
  );
  const payments = snapshot.expenseRules.flatMap((rule): Askable[] =>
    rule.isActive
      ? [
          {
            kind: "EXPENSE",
            id: rule.id,
            label: rule.label,
            expectedAmount: rule.expectedAmount,
            schedule: rule.schedule,
            trackedSince: rule.trackedSince,
            records: snapshot.transactions.filter((tx) => tx.recurringRuleId === rule.id),
          },
        ]
      : [],
  );
  return [...incomes, ...payments];
}

/** „Jeszcze nie”: zapis PENDING z datą, od której pytać znowu, późniejszą niż dziś. */
function isSnoozed(records: OccurrenceRecord[], occurrenceDate: IsoDate, today: IsoDate): boolean {
  return records.some(
    (record) =>
      record.status === "PENDING" &&
      record.occurrenceDate === occurrenceDate &&
      record.date > today,
  );
}

function kindOrder(kind: DueConfirmationLine["kind"]): number {
  return kind === "INCOME" ? 0 : 1;
}
