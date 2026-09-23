import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateGoalInput, Goal, UpdateGoalInput } from '@vireo/shared';

import { fromIsoDate, toIsoDate } from '../common/dates.js';
import type { Goal as GoalRow } from '../generated/prisma/client.js';
import type { Db } from '../prisma/prisma.module.js';
import { PRISMA } from '../prisma/prisma.module.js';

@Injectable()
export class GoalsService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  /** Najbliższy termin pierwszy — to ten cel jest najbardziej "pilny". */
  async list(userId: string): Promise<Goal[]> {
    const rows = await this.db.goal.findMany({
      where: { userId },
      orderBy: [{ targetDate: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toGoal);
  }

  async get(userId: string, id: string): Promise<Goal> {
    const row = await this.db.goal.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException();
    return toGoal(row);
  }

  async create(userId: string, input: CreateGoalInput): Promise<Goal> {
    const row = await this.db.goal.create({
      data: { ...input, userId, targetDate: fromIsoDate(input.targetDate) },
    });
    return toGoal(row);
  }

  /** `deletedAt: null` — jak przy transakcjach: nie edytujemy celów z kosza. */
  async update(userId: string, id: string, input: UpdateGoalInput): Promise<Goal> {
    const row = await this.db.goal.update({
      where: { id, userId, deletedAt: null },
      data: { ...input, targetDate: input.targetDate && fromIsoDate(input.targetDate) },
    });
    return toGoal(row);
  }

  /** Miękkie usunięcie — postęp celu da się odzyskać przez restore. */
  async remove(userId: string, id: string): Promise<void> {
    await this.db.goal.delete({ where: { id, userId, deletedAt: null } });
  }

  async restore(userId: string, id: string): Promise<Goal> {
    const row = await this.db.goal.update({
      where: { id, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return toGoal(row);
  }
}

function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    name: row.name,
    targetAmount: row.targetAmount,
    currentAmount: row.currentAmount,
    targetDate: toIsoDate(row.targetDate),
  };
}
