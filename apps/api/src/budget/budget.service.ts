import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  BudgetSnapshot,
  BudgetSummary,
  RecurrenceSchedule,
  SimulatePurchaseRequest,
  SimulationResult,
} from '@vireo/shared';
import {
  assembleBudgetInput,
  calculateAvailableBalance,
  currentBudgetPeriod,
  grosze,
  simulatePurchase,
  todayInTimeZone,
} from '@vireo/shared';

import type { Clock } from '../common/clock.js';
import { CLOCK } from '../common/clock.js';
import { fromIsoDate, toIsoDate } from '../common/dates.js';
import { OwnedReferencesService } from '../common/owned-references.service.js';
import type { RecurringRule } from '../generated/prisma/client.js';
import type { Db } from '../prisma/prisma.module.js';
import { PRISMA } from '../prisma/prisma.module.js';

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
    const input = assembleBudgetInput(await this.loadSnapshot(userId));
    const result = calculateAvailableBalance(input);
    return {
      period: input.period,
      asOf: input.asOf,
      availableBalance: result.availableBalance,
      daysRemaining: result.daysRemaining,
      dailyAllowance: result.dailyAllowance,
      breakdown: result.breakdown,
      fixedCommitments: input.remainingFixedCommitments,
      goalContributions: input.goalContributions,
    };
  }

  async simulate(userId: string, request: SimulatePurchaseRequest): Promise<SimulationResult> {
    await this.refs.assertCategory(userId, request.categoryId);
    const input = assembleBudgetInput(await this.loadSnapshot(userId));
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

  private async loadSnapshot(userId: string): Promise<BudgetSnapshot> {
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
    const [sources, entries, expenseRules, transactions, goals] = await Promise.all([
      this.db.incomeSource.findMany({ where: { userId }, include: { recurringRule: true } }),
      this.db.incomeEntry.findMany({ where: { userId, status: 'CONFIRMED', date: inPeriod } }),
      this.db.recurringRule.findMany({ where: { userId, kind: 'EXPENSE', isActive: true } }),
      this.db.transaction.findMany({ where: { userId, status: 'CONFIRMED', date: inPeriod } }),
      this.db.goal.findMany({ where: { userId } }),
    ]);

    return {
      today,
      periodStartDay: user.periodStartDay,
      incomeSources: sources.map((source) => ({
        id: source.id,
        kind: source.kind,
        expectedAmount: source.expectedAmount === null ? null : grosze(source.expectedAmount),
        isActive: source.isActive,
        schedule: source.recurringRule ? toSchedule(source.recurringRule) : null,
      })),
      incomeEntries: entries.map((entry) => ({
        incomeSourceId: entry.incomeSourceId,
        amount: grosze(entry.amount),
        date: toIsoDate(entry.date),
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
                // Pusty label = reguła bez nazwy; klient pokazuje wtedy
                // ogólny tekst z własnego katalogu tłumaczeń.
                label: rule.name ?? '',
                expectedAmount: grosze(rule.expectedAmount),
                isActive: rule.isActive,
                schedule: toSchedule(rule),
              },
            ],
      ),
      transactions: transactions.map((tx) => ({
        amount: grosze(tx.amount),
        date: toIsoDate(tx.date),
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

function toSchedule(rule: RecurringRule): RecurrenceSchedule {
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    startDate: toIsoDate(rule.startDate),
    dayOfMonth: rule.dayOfMonth,
    dayOfWeek: rule.dayOfWeek,
  };
}
