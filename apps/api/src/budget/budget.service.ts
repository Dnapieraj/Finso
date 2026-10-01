import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type {
  BudgetSnapshot,
  BudgetSummary,
  RecurrenceSchedule,
  SimulatePurchaseRequest,
  SimulationResult,
} from "@vireo/shared";
import {
  assembleBudgetInput,
  awaitingIncome,
  calculateAvailableBalance,
  currentBudgetPeriod,
  grosze,
  simulatePurchase,
  todayInTimeZone,
} from "@vireo/shared";

import type { Clock } from "../common/clock.js";
import { CLOCK } from "../common/clock.js";
import { fromIsoDate, toIsoDate } from "../common/dates.js";
import { OwnedReferencesService } from "../common/owned-references.service.js";
import type { RecurringRule } from "../generated/prisma/client.js";
import type { Db } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";

/**
 * Warstwa między bazą a silnikiem budżetu. Nie liczy niczego sama —
 * ładuje dane użytkownika, tłumaczy wiersze Prismy na typy silnika
 * i woła czyste funkcje z @vireo/shared. Każda reguła biznesowa
 * (co jest dochodem okresu, co jest opłacone) mieszka tam i tam ma testy.
 */
@Injectable()
export class BudgetService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly refs: OwnedReferencesService,
  ) {}

  async current(userId: string): Promise<BudgetSummary> {
    const snapshot = await this.snapshot(userId);
    const input = assembleBudgetInput(snapshot);
    const result = calculateAvailableBalance(input);
    return {
      period: input.period,
      asOf: input.asOf,
      availableBalance: result.availableBalance,
      daysRemaining: result.daysRemaining,
      dailyAllowance: result.dailyAllowance,
      breakdown: result.breakdown,
      awaitingIncome: awaitingIncome(snapshot),
      fixedCommitments: input.remainingFixedCommitments,
      goalContributions: input.goalContributions,
    };
  }

  async simulate(userId: string, request: SimulatePurchaseRequest): Promise<SimulationResult> {
    await this.refs.assertCategory(userId, request.categoryId);
    const input = assembleBudgetInput(await this.snapshot(userId));
    const before = calculateAvailableBalance(input);
    const result = simulatePurchase(input, grosze(request.amount), request.categoryId);
    return {
      canAfford: result.canAfford,
      riskLevel: result.riskLevel,
      before: {
        availableBalance: before.availableBalance,
        dailyAllowance: before.dailyAllowance,
      },
      remainingAfter: result.remainingAfter,
      dailyAllowanceAfter: result.dailyAllowanceAfter,
      goalImpacts: result.goalImpacts,
    };
  }

  /**
   * Stan użytkownika dla silnika z @vireo/shared — budżet i terminy do
   * potwierdzenia liczą się z tego samego snapshotu, więc się nie rozjadą.
   */
  async snapshot(userId: string): Promise<BudgetSnapshot> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { timezone: true, periodStartDay: true },
    });
    if (!user) throw new UnauthorizedException();

    const today = todayInTimeZone(this.clock.now(), user.timezone);
    // Okres liczony tu tylko po to, żeby zawęzić zapytania — silnik i tak
    // liczy go sam tą samą funkcją i odfiltrowuje wiersze spoza niego.
    const period = currentBudgetPeriod(today, user.periodStartDay);
    const inPeriod = { gte: fromIsoDate(period.start), lte: fromIsoDate(period.end) };

    // Soft-delete extension pomija usunięte transakcje, wpływy i cele.
    // Zapisy powiązane z regułą — wszystkie, w każdym statusie i z każdego
    // okresu: dopiero one mówią, które terminy są zaległe, a które
    // „Jeszcze nie”. Wpływów jest kilka w miesiącu, więc bierzemy całość.
    const [sources, entries, expenseRules, transactions, goals] = await Promise.all([
      this.db.incomeSource.findMany({ where: { userId }, include: { recurringRule: true } }),
      this.db.incomeEntry.findMany({ where: { userId } }),
      this.db.recurringRule.findMany({ where: { userId, kind: "EXPENSE", isActive: true } }),
      this.db.transaction.findMany({
        where: {
          userId,
          OR: [{ status: "CONFIRMED", date: inPeriod }, { recurringRuleId: { not: null } }],
        },
      }),
      this.db.goal.findMany({ where: { userId } }),
    ]);

    return {
      today,
      periodStartDay: user.periodStartDay,
      incomeSources: sources.map((source) => ({
        id: source.id,
        name: source.name,
        kind: source.kind,
        expectedAmount: source.expectedAmount === null ? null : grosze(source.expectedAmount),
        isActive: source.isActive,
        schedule: source.recurringRule ? toSchedule(source.recurringRule) : null,
        ...(source.recurringRule && {
          trackedSince: todayInTimeZone(source.recurringRule.createdAt, user.timezone),
        }),
      })),
      incomeEntries: entries.map((entry) => ({
        incomeSourceId: entry.incomeSourceId,
        amount: grosze(entry.amount),
        date: toIsoDate(entry.date),
        occurrenceDate: entry.occurrenceDate && toIsoDate(entry.occurrenceDate),
        status: entry.status,
      })),
      // Reguła EXPENSE bez kwoty nie przejdzie walidacji API, ale gdyby
      // jakaś była w bazie — nie ma czego odjąć, więc ją pomijamy.
      expenseRules: expenseRules.flatMap((rule) =>
        rule.expectedAmount === null
          ? []
          : [
              {
                id: rule.id,
                // Nazwa reguły wydatku jest wymagana od walidacji API
                // (recurringRuleShapeSchema); kolumna jest nullable tylko
                // dla reguł INCOME, więc `??` to wyłącznie obrona typów.
                label: rule.name ?? "",
                expectedAmount: grosze(rule.expectedAmount),
                isActive: rule.isActive,
                schedule: toSchedule(rule),
                // Dzień dodania reguły: wcześniejsze terminy płacono bez Finso,
                // więc nie są zaległe, nawet gdy start harmonogramu jest dawniej.
                trackedSince: todayInTimeZone(rule.createdAt, user.timezone),
              },
            ],
      ),
      transactions: transactions.map((tx) => ({
        amount: grosze(tx.amount),
        date: toIsoDate(tx.date),
        occurrenceDate: tx.occurrenceDate && toIsoDate(tx.occurrenceDate),
        status: tx.status,
        recurringRuleId: tx.recurringRuleId,
      })),
      goals: goals.map((goal) => ({
        id: goal.id,
        targetAmount: grosze(goal.targetAmount),
        currentAmount: grosze(goal.currentAmount),
        targetDate: toIsoDate(goal.targetDate),
      })),
    };
  }
}

/** Harmonogram reguły z Prismy w kształcie silnika. */
export function toSchedule(rule: RecurringRule): RecurrenceSchedule {
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    startDate: toIsoDate(rule.startDate),
    dayOfMonth: rule.dayOfMonth,
    dayOfWeek: rule.dayOfWeek,
  };
}
