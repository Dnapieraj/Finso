import type { IsoDate } from "../date.js";
import { grosze, type Grosze } from "../money.js";
import { calculateGoalContribution } from "./calculate-goal-contribution.js";
import { currentBudgetPeriod, periodsUntil } from "./period.js";
import { occurrencesInPeriod, type RecurrenceSchedule } from "./recurrence.js";
import type {
  BudgetPeriod,
  FixedCommitment,
  GoalContributionLine,
  SimulatePurchaseInput,
} from "./types.js";

type ConfirmationStatus = "PENDING" | "CONFIRMED" | "DECLINED";

/** Źródło dochodu w kształcie potrzebnym do policzenia `periodIncome`. */
export interface BudgetIncomeSource {
  id: string;
  kind: "REGULAR" | "IRREGULAR";
  expectedAmount: Grosze | null;
  isActive: boolean;
  /** Harmonogram z podpiętej reguły INCOME; `null` = raz na okres. */
  schedule: RecurrenceSchedule | null;
}

export interface BudgetIncomeEntry {
  incomeSourceId: string;
  amount: Grosze;
  date: IsoDate;
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
}

/** Nieusunięta transakcja (soft-delete odfiltrowuje już zapytanie w API). */
export interface BudgetTransaction {
  amount: Grosze;
  date: IsoDate;
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
 *   źródeł zarchiwizowanych — pieniądze, które przyszły, są faktem;
 * - aktywne REGULAR: dodatkowo `expectedAmount` za każde wystąpienie
 *   harmonogramu w okresie, które nie ma jeszcze potwierdzonego wpływu
 *   (`max(0, wystąpienia − potwierdzone)`);
 * - IRREGULAR: tylko potwierdzone (dopóki nie ma forecastIrregularIncome).
 *
 * **remainingFixedCommitments** — per aktywna reguła EXPENSE:
 * `expectedAmount × max(0, wystąpienia w okresie − opłacone)`, gdzie
 * opłacone = potwierdzone transakcje z tym `recurringRuleId` w okresie.
 * Reguły w pełni opłacone nie trafiają na listę.
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

  const entries = confirmedInPeriod(snapshot.incomeEntries);
  const transactions = confirmedInPeriod(snapshot.transactions);

  return {
    period,
    asOf: snapshot.today,
    periodIncome: periodIncome(snapshot.incomeSources, entries, period),
    remainingFixedCommitments: remainingCommitments(snapshot.expenseRules, transactions, period),
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
  sources: BudgetIncomeSource[],
  confirmedEntries: BudgetIncomeEntry[],
  period: BudgetPeriod,
): Grosze {
  let total = 0;
  for (const source of sources) {
    const received = confirmedEntries.filter((entry) => entry.incomeSourceId === source.id);
    total += sumAmounts(received);
    if (source.kind === "REGULAR" && source.isActive && source.expectedAmount !== null) {
      const expectedCount = source.schedule
        ? occurrencesInPeriod(source.schedule, period).length
        : 1;
      total += source.expectedAmount * Math.max(0, expectedCount - received.length);
    }
  }
  return grosze(total);
}

function remainingCommitments(
  rules: BudgetExpenseRule[],
  confirmedTransactions: BudgetTransaction[],
  period: BudgetPeriod,
): FixedCommitment[] {
  return rules
    .filter((rule) => rule.isActive)
    .map((rule) => {
      const paid = confirmedTransactions.filter((tx) => tx.recurringRuleId === rule.id).length;
      const unpaid = Math.max(0, occurrencesInPeriod(rule.schedule, period).length - paid);
      return { label: rule.label, amount: grosze(rule.expectedAmount * unpaid) };
    })
    .filter((commitment) => commitment.amount > 0);
}

function isInPeriod(date: IsoDate, period: BudgetPeriod): boolean {
  return date >= period.start && date <= period.end;
}

function sumAmounts(rows: { amount: Grosze }[]): Grosze {
  return grosze(rows.reduce((sum, row) => sum + row.amount, 0));
}
