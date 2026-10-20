import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { ExportData } from "@vireo/shared";
import { todayInTimeZone } from "@vireo/shared";

import { CategoriesService } from "../categories/categories.service.js";
import type { Clock } from "../common/clock.js";
import { CLOCK } from "../common/clock.js";
import { toIsoDate } from "../common/dates.js";
import { GoalsService } from "../goals/goals.service.js";
import { IncomeSourcesService } from "../income/income-sources.service.js";
import type { Db } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";
import { RecurringRulesService } from "../recurring-rules/recurring-rules.service.js";

/**
 * Wszystkie dane użytkownika naraz. Soft-delete extension pomija kosz —
 * eksport to dokładnie to, co użytkownik widzi w appce. Wydatki i wpływy
 * od najstarszych, bez stronicowania: to jednorazowa kopia, nie lista.
 */
@Injectable()
export class ExportService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly categories: CategoriesService,
    private readonly goals: GoalsService,
    private readonly incomeSources: IncomeSourcesService,
    private readonly rules: RecurringRulesService,
  ) {}

  async get(userId: string): Promise<ExportData> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) throw new UnauthorizedException();

    const order = [{ date: "asc" as const }, { id: "asc" as const }];
    const [categories, expenses, incomeSources, incomeEntries, goals, recurringRules] =
      await Promise.all([
        this.categories.list(userId),
        this.db.transaction.findMany({ where: { userId }, orderBy: order }),
        this.incomeSources.list(userId),
        this.db.incomeEntry.findMany({ where: { userId }, orderBy: order }),
        this.goals.list(userId),
        this.rules.list(userId),
      ]);

    return {
      exportedOn: todayInTimeZone(this.clock.now(), user.timezone),
      categories,
      expenses: expenses.map((row) => ({
        id: row.id,
        amount: row.amount,
        date: toIsoDate(row.date),
        categoryId: row.categoryId,
        recurringRuleId: row.recurringRuleId,
        note: row.note,
        status: row.status,
        beforeFinso: row.beforeFinso,
        occurrenceDate: row.occurrenceDate && toIsoDate(row.occurrenceDate),
      })),
      incomeSources,
      incomeEntries: incomeEntries.map((row) => ({
        id: row.id,
        incomeSourceId: row.incomeSourceId,
        amount: row.amount,
        date: toIsoDate(row.date),
        status: row.status,
        occurrenceDate: row.occurrenceDate && toIsoDate(row.occurrenceDate),
      })),
      goals,
      recurringRules,
    };
  }
}
