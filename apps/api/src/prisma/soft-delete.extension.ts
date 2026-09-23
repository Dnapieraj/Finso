import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Dokłada `deletedAt: null` do `where`, nadpisując cokolwiek wywołujący
 * już tam wpisał — więc nawet ręczne `deletedAt: { not: null }` w kodzie
 * feature'a i tak zostaje wyzerowane. To jedyny fragment logiki, który
 * faktycznie decyduje "czy ten wiersz jest widoczny", więc ma osobne
 * testy w soft-delete.extension.spec.ts, niezależne od żywego Prisma
 * Client (który wymaga bazy, żeby cokolwiek wykonać).
 */
export function excludeDeleted<W extends object | undefined>(
  where: W,
): W & { deletedAt: null } {
  return { ...where, deletedAt: null } as W & { deletedAt: null };
}

/** Zamienia argumenty `delete`/`deleteMany` na argumenty `update`/`updateMany`. */
export function toSoftDelete<W>(where: W): { where: W; data: { deletedAt: Date } } {
  return { where, data: { deletedAt: new Date() } };
}

/**
 * Modele z miękkim usuwaniem. $extends() zwraca NOWY klient (nie
 * mutuje instancji, na której go wywołujemy) — dlatego to osobna
 * funkcja, a nie coś wpięte prosto w konstruktor PrismaService.
 *
 * Każde findMany/findFirst/findUnique/count/aggregate/groupBy na
 * Transaction i Goal dostaje wymuszony filtr `deletedAt: null`.
 * delete/deleteMany nigdy nie trafiają do bazy jako DELETE — zamieniają
 * się w update ustawiający deletedAt. update/updateMany celowo NIE są
 * filtrowane — inaczej przywrócenie skasowanego rekordu byłoby
 * niemożliwe (własny warunek `deletedAt: null` blokowałby trafienie
 * w wiersz, który właśnie ma deletedAt ustawione).
 */
export function withSoftDelete<T extends PrismaClient>(client: T) {
  return client.$extends({
    name: 'soft-delete',
    query: {
      transaction: {
        async findMany({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async findFirstOrThrow({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async findUnique({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async findUniqueOrThrow({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async count({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async aggregate({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async groupBy({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async delete({ args }) {
          return client.transaction.update(toSoftDelete(args.where));
        },
        async deleteMany({ args }) {
          return client.transaction.updateMany(toSoftDelete(args.where));
        },
      },
      goal: {
        async findMany({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async findFirstOrThrow({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async findUnique({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async findUniqueOrThrow({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async count({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async aggregate({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async groupBy({ args, query }) {
          args.where = excludeDeleted(args.where);
          return query(args);
        },
        async delete({ args }) {
          return client.goal.update(toSoftDelete(args.where));
        },
        async deleteMany({ args }) {
          return client.goal.updateMany(toSoftDelete(args.where));
        },
      },
    },
  });
}
