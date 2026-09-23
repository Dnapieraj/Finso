import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@vireo/shared';

import type { Category as CategoryRow } from '../generated/prisma/client.js';
import type { Db } from '../prisma/prisma.module.js';
import { PRISMA } from '../prisma/prisma.module.js';

/** Kategorie widoczne dla użytkownika: systemowe (userId = null) + własne. */
const visibleTo = (userId: string) => ({ OR: [{ userId }, { userId: null }] });

@Injectable()
export class CategoriesService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  async list(userId: string): Promise<Category[]> {
    const rows = await this.db.category.findMany({
      where: visibleTo(userId),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toCategory);
  }

  async get(userId: string, id: string): Promise<Category> {
    const row = await this.db.category.findFirst({ where: { id, ...visibleTo(userId) } });
    if (!row) throw new NotFoundException();
    return toCategory(row);
  }

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    return toCategory(await this.db.category.create({ data: { ...input, userId } }));
  }

  /**
   * `where: { id, userId }` — kategoria systemowa ma userId = null, więc
   * nie pasuje i kończy się 404 (PrismaNotFoundFilter), tak samo jak cudza.
   */
  async update(userId: string, id: string, input: UpdateCategoryInput): Promise<Category> {
    return toCategory(await this.db.category.update({ where: { id, userId }, data: input }));
  }

  /** Transakcje i reguły z tą kategorią zostają — baza ustawia im categoryId = null. */
  async remove(userId: string, id: string): Promise<void> {
    await this.db.category.delete({ where: { id, userId } });
  }
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    isSystem: row.userId === null,
  };
}
