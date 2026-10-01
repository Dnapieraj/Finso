import type { IsoDate } from "../date.js";
import { grosze, type Grosze } from "../money.js";
import { calculateGoalContribution } from "./calculate-goal-contribution.js";
import { currentBudgetPeriod, periodsUntil } from "./period.js";
import { openOccurrences, type ConfirmationStatus } from "./occurrences.js";
import type { RecurrenceSchedule } from "./recurrence.js";
import type {
  BudgetPeriod,
  FixedCommitment,
  GoalContributionLine,
  SimulatePurchaseInput,
} from "./types.js";

/** Źródło dochodu w kształcie potrzebnym do policzenia `periodIncome`. */
export interface BudgetIncomeSource {
  id: string;
  /** Do pytania „Pensja 5000 zł — wpłynęła?”. */
  name: string;
  kind: "REGULAR" | "IRREGULAR";
  expectedAmount: Grosze | null;
  isActive: boolean;
  /** Harmonogram z podpiętej reguły INCOME; `null` = raz na okres. */
  schedule: RecurrenceSchedule | null;
  /** Od kiedy Finso śledzi harmonogram — zaległe tylko od tego dnia (domyślnie start). */
  trackedSince?: IsoDate;
}

export interface BudgetIncomeEntry {
  incomeSourceId: string;
  amount: Grosze;
  /** Dzień wpływu; przy PENDING („Jeszcze nie”) — dzień, od którego appka pyta znowu. */
  date: IsoDate;
  /** Termin harmonogramu, na który odpowiada; brak = wpis ręczny lub sprzed potwierdzania. */
  occurrenceDate?: IsoDate | null;
  status: ConfirmationStatus;
}

/** Aktywna lub nie reguła EXPENSE — źródło `remainingFixedCommitments`. */
export interface BudgetExpenseRule {
  id: string;
  /** Do breakdownu w UI — API podaje nazwę reguły. */
  label: string;
  expectedAmount: Grosze;
  isActive: boolean;
  schedule: RecurrenceSchedule;
  /** Od kiedy reguła jest w Finso — zaległe tylko od tego dnia (domyślnie start). */
  trackedSince?: IsoDate;
}

/** Nieusunięta transakcja (soft-delete odfiltrowuje już zapytanie w API). */
export interface BudgetTransaction {
  amount: Grosze;
  /** Dzień wydatku; przy PENDING („Jeszcze nie”) — dzień, od którego appka pyta znowu. */
  date: IsoDate;
  /** Termin reguły, na który odpowiada; brak = wydatek ręczny lub sprzed potwierdzania. */
  occurrenceDate?: IsoDate | null;
  status: ConfirmationStatus;
  recurringRuleId: string | null;
}

export interface BudgetGoal {
  id: string;
  targetAmount: Grosze;
  currentAmount: Grosze;
  targetDate: IsoDate;
}

/**
 * Surowy stan użytkownika. Wpisy i transakcje mogą wykraczać poza okres
 * — funkcja sama odfiltrowuje to, co do niego nie należy.
 */
export interface BudgetSnapshot {
  /** Dzisiejsza data W STREFIE UŻYTKOWNIKA (todayInTimeZone). */
  today: IsoDate;
  periodStartDay: number;
  incomeSources: BudgetIncomeSource[];
  incomeEntries: BudgetIncomeEntry[];
  expenseRules: BudgetExpenseRule[];
  transactions: BudgetTransaction[];
  goals: BudgetGoal[];
}

/**
 * Składa wejście silnika budżetu (calculateAvailableBalance /
 * simulatePurchase) ze stanu użytkownika. Reguły:
 *
 * **periodIncome** — suma po źródłach:
 * - potwierdzone (CONFIRMED) wpływy z okresu liczą się zawsze, także ze
 *   źródeł zarchiwizowanych i zaległe z poprzednich okresów potwierdzone
 *   teraz — pieniądze, które przyszły, są faktem;
 * - aktywne REGULAR: dodatkowo `expectedAmount` za każdy otwarty termin
 *   harmonogramu w okresie ({@link openOccurrences}); bez harmonogramu —
 *   raz na okres, jeśli nic jeszcze nie wpłynęło;
 * - zaległe terminy wpływów z poprzednich okresów się NIE liczą: pieniądze,
 *   których nie ma od miesiąca, nie są do wydania, dopóki nie wpłyną;
 * - IRREGULAR: tylko potwierdzone (dopóki nie ma forecastIrregularIncome).
 *
 * **remainingFixedCommitments** — per aktywna reguła EXPENSE:
 * `expectedAmount × otwarte terminy`, osobno zaległe z poprzednich okresów
 * (pozycja z `overdue: true`, jeszcze do zapłacenia) i bieżące. Termin
 * zamyka zapłata (CONFIRMED) albo „Nie w tym okresie” (DECLINED).
 *
 * **alreadySpent** — suma potwierdzonych transakcji z okresu.
 *
 * **goalContributions** / **goals** — każdy cel z ratą z
 * calculateGoalContribution(cel, periodsUntil(...)).
 */
export function assembleBudgetInput(snapshot: BudgetSnapshot): SimulatePurchaseInput {
  const period = currentBudgetPeriod(snapshot.today, snapshot.periodStartDay);
  const confirmedInPeriod = <T extends { date: IsoDate; status: ConfirmationStatus }>(rows: T[]) =>
    rows.filter((row) => row.status === "CONFIRMED" && isInPeriod(row.date, period));

  const transactions = confirmedInPeriod(snapshot.transactions);

  return {
    period,
    asOf: snapshot.today,
    periodIncome: periodIncome(snapshot, confirmedInPeriod(snapshot.incomeEntries), period),
    remainingFixedCommitments: remainingCommitments(snapshot, period),
    goalContributions: snapshot.goals.map((goal): GoalContributionLine => ({
      goalId: goal.id,
      amount: calculateGoalContribution(
        goal,
        periodsUntil(snapshot.today, goal.targetDate, snapshot.periodStartDay),
      ).contributionPerPeriod,
    })),
    alreadySpent: sumAmounts(transactions),
    goals: snapshot.goals.map((goal) => ({ ...goal })),
  };
}

function periodIncome(
  snapshot: BudgetSnapshot,
  confirmedInPeriod: BudgetIncomeEntry[],
  period: BudgetPeriod,
): Grosze {
  let total = 0;
  for (const source of snapshot.incomeSources) {
    const received = confirmedInPeriod.filter((entry) => entry.incomeSourceId === source.id);
    total += sumAmounts(received);
    if (source.kind !== "REGULAR" || !source.isActive || source.expectedAmount === null) {
      continue;
    }
    if (source.schedule === null) {
      total += source.expectedAmount * Math.max(0, 1 - received.length);
      continue;
    }
    const records = snapshot.incomeEntries.filter((entry) => entry.incomeSourceId === source.id);
    const open = openOccurrences(
      source.schedule,
      records,
      period,
      snapshot.periodStartDay,
      source.trackedSince,
    );
    total += source.expectedAmount * open.current.length;
  }
  return grosze(total);
}

function remainingCommitments(snapshot: BudgetSnapshot, period: BudgetPeriod): FixedCommitment[] {
  return snapshot.expenseRules
    .filter((rule) => rule.isActive)
    .flatMap((rule) => {
      const records = snapshot.transactions.filter((tx) => tx.recurringRuleId === rule.id);
      const open = openOccurrences(
        rule.schedule,
        records,
        period,
        snapshot.periodStartDay,
        rule.trackedSince,
      );
      const lines: FixedCommitment[] = [];
      if (open.overdue.length > 0) {
        lines.push({
          label: rule.label,
          amount: grosze(rule.expectedAmount * open.overdue.length),
          overdue: true,
        });
      }
      if (open.current.length > 0) {
        lines.push({
          label: rule.label,
          amount: grosze(rule.expectedAmount * open.current.length),
        });
      }
      return lines;
    });
}

function isInPeriod(date: IsoDate, period: BudgetPeriod): boolean {
  return date >= period.start && date <= period.end;
}

function sumAmounts(rows: { amount: Grosze }[]): Grosze {
  return grosze(rows.reduce((sum, row) => sum + row.amount, 0));
}
