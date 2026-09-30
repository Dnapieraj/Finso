import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateTransactionInput,
  IsoDate,
  ListTransactionsQuery,
  Transaction,
  TransactionPage,
  TransactionSummary,
  UpdateTransactionInput,
} from "@vireo/shared";

import { fromIsoDate, toIsoDate } from "../common/dates.js";
import { OwnedReferencesService } from "../common/owned-references.service.js";
import { dateRange, toPage } from "../common/pagination.js";
import type { Transaction as TransactionRow } from "../generated/prisma/client.js";
import type { Db, DbTransaction } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly refs: OwnedReferencesService,
  ) {}

  /** Najnowsze pierwsze. Miękko usunięte pomija soft-delete extension. */
  async list(userId: string, query: ListTransactionsQuery): Promise<TransactionPage> {
    if (query.cursor) {
      // Kursor z cudzej transakcji "działałby" (Prisma porównuje po jego
      // dacie) i zdradzałby, kiedy ktoś inny coś kupił. Tylko własne.
      const owned = await this.db.transaction.count({ where: { id: query.cursor, userId } });
      if (owned === 0) throw new BadRequestException("Invalid cursor");
    }
    const rows = await this.db.transaction.findMany({
      where: {
        userId,
        categoryId: query.categoryId,
        status: query.status,
        date: dateRange(query.from && fromIsoDate(query.from), query.to && fromIsoDate(query.to)),
      },
      // `id` jako drugi klucz: kilka wydatków z tego samego dnia musi mieć
      // stałą kolejność, inaczej kursor mógłby pominąć lub powtórzyć wiersz.
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return toPage(rows, query.limit, toTransaction);
  }

  /**
   * Suma i liczba wydatków okresu per kategoria, od największej sumy.
   * Liczone w bazie, nie z listy: lista jest stronicowana, a wykres ma
   * obejmować cały okres. Te same wydatki co w budżecie — potwierdzone,
   * bez kosza (soft-delete extension obejmuje też groupBy).
   */
  async summary(
    userId: string,
    query: { from: IsoDate; to: IsoDate },
  ): Promise<TransactionSummary> {
    const groups = await this.db.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        status: "CONFIRMED",
        date: { gte: fromIsoDate(query.from), lte: fromIsoDate(query.to) },
      },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const byCategory = groups
      .map((group) => ({
        categoryId: group.categoryId,
        amount: group._sum.amount ?? 0,
        count: group._count._all,
      }))
      // Przy równych sumach stała kolejność: kategoria przed „bez kategorii”, potem po id.
      .sort(
        (a, b) => b.amount - a.amount || (a.categoryId ?? "~").localeCompare(b.categoryId ?? "~"),
      );
    return {
      total: byCategory.reduce((sum, line) => sum + line.amount, 0),
      count: byCategory.reduce((sum, line) => sum + line.count, 0),
      byCategory,
    };
  }

  async get(userId: string, id: string): Promise<Transaction> {
    const row = await this.db.transaction.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException();
    return toTransaction(row);
  }

  /** `db` pozwala zapisać wydatek w jednej transakcji z kluczem idempotencji. */
  async create(
    userId: string,
    input: CreateTransactionInput,
    db: Db | DbTransaction = this.db,
  ): Promise<Transaction> {
    await this.refs.assertCategory(userId, input.categoryId);
    await this.refs.assertRecurringRule(userId, input.recurringRuleId, "EXPENSE");
    const row = await db.transaction.create({
      data: {
        userId,
        amount: input.amount,
        date: fromIsoDate(input.date),
        categoryId: input.categoryId ?? null,
        recurringRuleId: input.recurringRuleId ?? null,
        note: input.note ?? null,
        status: input.status,
      },
    });
    return toTransaction(row);
  }

  /**
   * `deletedAt: null` jawnie w where: soft-delete extension celowo NIE
   * filtruje `update` (inaczej restore byłby niemożliwy), więc bez tego
   * dałoby się edytować transakcję z kosza.
   */
  async update(userId: string, id: string, input: UpdateTransactionInput): Promise<Transaction> {
    await this.refs.assertCategory(userId, input.categoryId);
    await this.refs.assertRecurringRule(userId, input.recurringRuleId, "EXPENSE");
    const row = await this.db.transaction.update({
      where: { id, userId, deletedAt: null },
      data: { ...input, date: input.date && fromIsoDate(input.date) },
    });
    return toTransaction(row);
  }

  /** Miękkie usunięcie — extension zamienia `delete` na ustawienie deletedAt. */
  async remove(userId: string, id: string): Promise<void> {
    await this.db.transaction.delete({ where: { id, userId, deletedAt: null } });
  }

  /** Cofnięcie usunięcia. 404, jeśli transakcja nie jest w koszu (albo nie jest nasza). */
  async restore(userId: string, id: string): Promise<Transaction> {
    const row = await this.db.transaction.update({
      where: { id, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return toTransaction(row);
  }
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    amount: row.amount,
    date: toIsoDate(row.date),
    categoryId: row.categoryId,
    recurringRuleId: row.recurringRuleId,
    note: row.note,
    status: row.status,
  };
}
