import type { IsoDate } from '../date.js';
import type { Grosze } from '../money.js';
import type { RecurrenceSchedule } from './recurrence.js';
import type { SimulatePurchaseInput } from './types.js';

type ConfirmationStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED';

/** Źródło dochodu w kształcie potrzebnym do policzenia `periodIncome`. */
export interface BudgetIncomeSource {
  id: string;
  kind: 'REGULAR' | 'IRREGULAR';
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
export declare function assembleBudgetInput(snapshot: BudgetSnapshot): SimulatePurchaseInput;
