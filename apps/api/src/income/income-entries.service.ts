import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateIncomeEntryInput,
  IncomeEntry,
  IncomeEntryPage,
  ListIncomeEntriesQuery,
  UpdateIncomeEntryInput,
} from '@vireo/shared';

import { fromIsoDate, toIsoDate } from '../common/dates.js';
import { OwnedReferencesService } from '../common/owned-references.service.js';
import { dateRange, toPage } from '../common/pagination.js';
import type { IncomeEntry as IncomeEntryRow } from '../generated/prisma/client.js';
import type { Db } from '../prisma/prisma.module.js';
import { PRISMA } from '../prisma/prisma.module.js';

@Injectable()
export class IncomeEntriesService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly refs: OwnedReferencesService,
  ) {}

  /** Najnowsze pierwsze — patrz TransactionsService.list po uzasadnienie kursora. */
  async list(userId: string, query: ListIncomeEntriesQuery): Promise<IncomeEntryPage> {
    if (query.cursor) {
      const owned = await this.db.incomeEntry.count({ where: { id: query.cursor, userId } });
      if (owned === 0) throw new BadRequestException('Invalid cursor');
    }
    const rows = await this.db.incomeEntry.findMany({
      where: {
        userId,
        incomeSourceId: query.incomeSourceId,
        date: dateRange(
          query.from && fromIsoDate(query.from),
          query.to && fromIsoDate(query.to),
        ),
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return toPage(rows, query.limit, toIncomeEntry);
  }

  async get(userId: string, id: string): Promise<IncomeEntry> {
    const row = await this.db.incomeEntry.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException();
    return toIncomeEntry(row);
  }

  async create(userId: string, input: CreateIncomeEntryInput): Promise<IncomeEntry> {
    await this.refs.assertIncomeSource(userId, input.incomeSourceId);
    const row = await this.db.incomeEntry.create({
      data: { ...input, userId, date: fromIsoDate(input.date) },
    });
    return toIncomeEntry(row);
  }

  /**
   * Najczęstsza zmiana: potwierdzenie spodziewanego wpływu, często z inną
   * kwotą. `deletedAt: null` — wpływów z kosza nie edytujemy (patrz
   * TransactionsService.update).
   */
  async update(userId: string, id: string, input: UpdateIncomeEntryInput): Promise<IncomeEntry> {
    const row = await this.db.incomeEntry.update({
      where: { id, userId, deletedAt: null },
      data: { ...input, date: input.date && fromIsoDate(input.date) },
    });
    return toIncomeEntry(row);
  }

  /** Miękkie usunięcie — extension zamienia `delete` na ustawienie deletedAt. */
  async remove(userId: string, id: string): Promise<void> {
    await this.db.incomeEntry.delete({ where: { id, userId, deletedAt: null } });
  }

  async restore(userId: string, id: string): Promise<IncomeEntry> {
    const row = await this.db.incomeEntry.update({
      where: { id, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return toIncomeEntry(row);
  }
}

function toIncomeEntry(row: IncomeEntryRow): IncomeEntry {
  return {
    id: row.id,
    incomeSourceId: row.incomeSourceId,
    amount: row.amount,
    date: toIsoDate(row.date),
    status: row.status,
  };
}
