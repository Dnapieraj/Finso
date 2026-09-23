import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateRecurringRuleInput,
  RecurringRule,
  UpdateRecurringRuleInput,
} from '@vireo/shared';
import { recurringRuleShapeSchema } from '@vireo/shared';
import { ZodValidationException } from 'nestjs-zod';

import { fromIsoDate, toIsoDate } from '../common/dates.js';
import { OwnedReferencesService } from '../common/owned-references.service.js';
import type { RecurringRule as RecurringRuleRow } from '../generated/prisma/client.js';
import type { Db } from '../prisma/prisma.module.js';
import { PRISMA } from '../prisma/prisma.module.js';

@Injectable()
export class RecurringRulesService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly refs: OwnedReferencesService,
  ) {}

  async list(userId: string): Promise<RecurringRule[]> {
    const rows = await this.db.recurringRule.findMany({
      where: { userId },
      orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toRecurringRule);
  }

  async get(userId: string, id: string): Promise<RecurringRule> {
    const row = await this.db.recurringRule.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException();
    return toRecurringRule(row);
  }

  async create(userId: string, input: CreateRecurringRuleInput): Promise<RecurringRule> {
    await this.refs.assertCategory(userId, input.categoryId);
    const row = await this.db.recurringRule.create({
      data: { ...input, userId, startDate: fromIsoDate(input.startDate) },
    });
    return toRecurringRule(row);
  }

  /**
   * PATCH niesie tylko zmienione pola, a reguły spójności (np. WEEKLY
   * wymaga dayOfWeek) dotyczą całości. Dlatego scalamy zmiany ze stanem
   * z bazy i walidujemy wynik — `frequency: 'WEEKLY'` bez `dayOfWeek`
   * przy regule, która go nie miała, to 400, a nie zepsuta reguła.
   */
  async update(userId: string, id: string, input: UpdateRecurringRuleInput): Promise<RecurringRule> {
    const existing = await this.db.recurringRule.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException();

    const shape = recurringRuleShapeSchema.safeParse({
      kind: existing.kind,
      frequency: input.frequency ?? existing.frequency,
      dayOfMonth: input.dayOfMonth !== undefined ? input.dayOfMonth : existing.dayOfMonth,
      dayOfWeek: input.dayOfWeek !== undefined ? input.dayOfWeek : existing.dayOfWeek,
      expectedAmount:
        input.expectedAmount !== undefined ? input.expectedAmount : existing.expectedAmount,
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
    });
    if (!shape.success) throw new ZodValidationException(shape.error);
    await this.refs.assertCategory(userId, input.categoryId);

    const row = await this.db.recurringRule.update({
      where: { id, userId },
      data: { ...input, startDate: input.startDate && fromIsoDate(input.startDate) },
    });
    return toRecurringRule(row);
  }

  /**
   * Twarde usunięcie. Transakcje i źródło dochodu zostają (baza ustawia im
   * recurringRuleId = null). Żeby zachować powiązanie z historią, klient
   * powinien raczej ustawić `isActive: false`.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.db.recurringRule.delete({ where: { id, userId } });
  }
}

function toRecurringRule(row: RecurringRuleRow): RecurringRule {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    frequency: row.frequency,
    interval: row.interval,
    startDate: toIsoDate(row.startDate),
    dayOfMonth: row.dayOfMonth,
    dayOfWeek: row.dayOfWeek,
    expectedAmount: row.expectedAmount,
    categoryId: row.categoryId,
    isActive: row.isActive,
  };
}
