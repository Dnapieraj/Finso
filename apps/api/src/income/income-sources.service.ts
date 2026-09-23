import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateIncomeSourceInput,
  IncomeSource,
  UpdateIncomeSourceInput,
} from '@vireo/shared';
import { incomeSourceShapeSchema } from '@vireo/shared';
import { ZodValidationException } from 'nestjs-zod';

import { OwnedReferencesService } from '../common/owned-references.service.js';
import type { IncomeSource as IncomeSourceRow } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Db } from '../prisma/prisma.module.js';
import { PRISMA } from '../prisma/prisma.module.js';

const UNIQUE_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';

@Injectable()
export class IncomeSourcesService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly refs: OwnedReferencesService,
  ) {}

  async list(userId: string): Promise<IncomeSource[]> {
    const rows = await this.db.incomeSource.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(toIncomeSource);
  }

  async get(userId: string, id: string): Promise<IncomeSource> {
    const row = await this.db.incomeSource.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException();
    return toIncomeSource(row);
  }

  async create(userId: string, input: CreateIncomeSourceInput): Promise<IncomeSource> {
    await this.refs.assertRecurringRule(userId, input.recurringRuleId, 'INCOME');
    return toIncomeSource(
      await withRuleConflict(() => this.db.incomeSource.create({ data: { ...input, userId } })),
    );
  }

  /** Jak przy regułach: spójność REGULAR/IRREGULAR sprawdzana po scaleniu ze stanem z bazy. */
  async update(userId: string, id: string, input: UpdateIncomeSourceInput): Promise<IncomeSource> {
    const existing = await this.db.incomeSource.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException();

    const shape = incomeSourceShapeSchema.safeParse({
      kind: input.kind ?? existing.kind,
      expectedAmount:
        input.expectedAmount !== undefined ? input.expectedAmount : existing.expectedAmount,
    });
    if (!shape.success) throw new ZodValidationException(shape.error);
    await this.refs.assertRecurringRule(userId, input.recurringRuleId, 'INCOME');

    return toIncomeSource(
      await withRuleConflict(() =>
        this.db.incomeSource.update({ where: { id, userId }, data: input }),
      ),
    );
  }

  /**
   * Twarde usunięcie — tylko źródła bez wpływów (np. dodanego przez
   * pomyłkę). Źródło z historią się archiwizuje (`isActive: false`).
   * Pilnuje tego baza (FK z onDelete: NoAction), nie ten kod: widzi też
   * wpływy w koszu, których soft-delete extension nam nie pokaże.
   */
  async remove(userId: string, id: string): Promise<void> {
    try {
      await this.db.incomeSource.delete({ where: { id, userId } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === FOREIGN_KEY_VIOLATION
      ) {
        throw new ConflictException(
          'Income source has income entries (possibly deleted) — archive it with isActive: false',
        );
      }
      throw error;
    }
  }
}

/** Reguła może opisywać tylko jedno źródło (unikalny recurringRuleId). */
async function withRuleConflict<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
      throw new ConflictException('Recurring rule already linked to another income source');
    }
    throw error;
  }
}

function toIncomeSource(row: IncomeSourceRow): IncomeSource {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    expectedAmount: row.expectedAmount,
    recurringRuleId: row.recurringRuleId,
    isActive: row.isActive,
  };
}
