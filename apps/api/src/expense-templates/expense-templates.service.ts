import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateExpenseTemplateInput,
  ExpenseTemplate,
  UpdateExpenseTemplateInput,
} from "@vireo/shared";

import { OwnedReferencesService } from "../common/owned-references.service.js";
import type { ExpenseTemplate as ExpenseTemplateRow } from "../generated/prisma/client.js";
import type { Db } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";

/**
 * Szablony szybkiego dodawania. Ustawienie, nie dane finansowe: bez kosza
 * i bez klucza idempotencji (podwójny szablon widać na liście i łatwo usunąć).
 */
@Injectable()
export class ExpenseTemplatesService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly refs: OwnedReferencesService,
  ) {}

  /** W kolejności dodania — tak, jak użytkownik je ułożył na ekranie. */
  async list(userId: string): Promise<ExpenseTemplate[]> {
    const rows = await this.db.expenseTemplate.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toExpenseTemplate);
  }

  async get(userId: string, id: string): Promise<ExpenseTemplate> {
    const row = await this.db.expenseTemplate.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException();
    return toExpenseTemplate(row);
  }

  async create(userId: string, input: CreateExpenseTemplateInput): Promise<ExpenseTemplate> {
    await this.refs.assertCategory(userId, input.categoryId);
    const row = await this.db.expenseTemplate.create({ data: { ...input, userId } });
    return toExpenseTemplate(row);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateExpenseTemplateInput,
  ): Promise<ExpenseTemplate> {
    await this.refs.assertCategory(userId, input.categoryId);
    const row = await this.db.expenseTemplate.update({ where: { id, userId }, data: input });
    return toExpenseTemplate(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.expenseTemplate.delete({ where: { id, userId } });
  }
}

function toExpenseTemplate(row: ExpenseTemplateRow): ExpenseTemplate {
  return { id: row.id, name: row.name, amount: row.amount, categoryId: row.categoryId };
}
