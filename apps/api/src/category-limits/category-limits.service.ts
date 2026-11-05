import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CategoryLimitsOverview, SetCategoryLimitInput } from "@vireo/shared";
import {
  budgetPeriodAt,
  categoryLimitStatuses,
  currentBudgetPeriod,
  grosze,
  incomeForecasts,
  leanMonth,
} from "@vireo/shared";

import { BudgetService } from "../budget/budget.service.js";
import { fromIsoDate, toIsoDate } from "../common/dates.js";
import { OwnedReferencesService } from "../common/owned-references.service.js";
import type { Db } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";

/** Tyle pełnych okresów wstecz potrzebuje leanMonth do „zwykłych” wydatków. */
const HISTORY_PERIODS = 3;

/**
 * Limity na kategorie. Ustawienie, nie dane finansowe: PUT nadpisuje
 * (bez klucza idempotencji — powtórzenie daje to samo), DELETE usuwa naprawdę.
 * Liczy @vireo/shared; tu tylko dane użytkownika.
 */
@Injectable()
export class CategoryLimitsService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly budget: BudgetService,
    private readonly refs: OwnedReferencesService,
  ) {}

  async overview(userId: string): Promise<CategoryLimitsOverview> {
    // Ten sam snapshot co budżet: „dziś”, okres i prognozy się nie rozjadą.
    const snapshot = await this.budget.snapshot(userId);
    const period = currentBudgetPeriod(snapshot.today, snapshot.periodStartDay);
    const from = budgetPeriodAt(snapshot.today, snapshot.periodStartDay, -HISTORY_PERIODS).start;

    // Soft-delete extension pomija wydatki w koszu.
    const [rows, transactions] = await Promise.all([
      this.db.categoryLimit.findMany({
        where: { userId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      this.db.transaction.findMany({
        where: { userId, date: { gte: fromIsoDate(from), lte: fromIsoDate(period.end) } },
        select: {
          categoryId: true,
          amount: true,
          date: true,
          status: true,
          recurringRuleId: true,
          beforeFinso: true,
        },
      }),
    ]);

    const limits = rows.map((row) => ({ categoryId: row.categoryId, amount: grosze(row.amount) }));
    const expenses = transactions.map((tx) => ({
      ...tx,
      amount: grosze(tx.amount),
      date: toIsoDate(tx.date),
    }));
    const base = { today: snapshot.today, periodStartDay: snapshot.periodStartDay };

    return {
      limits: categoryLimitStatuses({ ...base, limits, expenses }),
      leanMonth: leanMonth({
        ...base,
        forecasts: incomeForecasts(snapshot),
        expenses,
        limits,
        // Bez daty startu nie wiadomo, które okresy są „zwykłe” — wtedy żadne.
        trackedSince: snapshot.trackedSince ?? snapshot.today,
      }),
    };
  }

  async set(userId: string, categoryId: string, input: SetCategoryLimitInput): Promise<void> {
    await this.refs.assertCategory(userId, categoryId);
    await this.db.categoryLimit.upsert({
      where: { userId_categoryId: { userId, categoryId } },
      create: { userId, categoryId, amount: input.amount },
      update: { amount: input.amount },
    });
  }

  async remove(userId: string, categoryId: string): Promise<void> {
    const { count } = await this.db.categoryLimit.deleteMany({ where: { userId, categoryId } });
    if (count === 0) throw new NotFoundException();
  }
}
