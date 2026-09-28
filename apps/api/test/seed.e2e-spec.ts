import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import request from 'supertest';

import { SYSTEM_CATEGORIES, seedSystemCategories } from '../prisma/system-categories.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { TestSession } from './helpers.js';
import { createTestApp, createTestDb, registerUser, resetDb } from './helpers.js';
import { TEST_DATABASE_URL } from './test-env.js';

/** Id kategorii systemowych sprzed poprawki — tak je zapisywał stary seed. */
const LEGACY_IDS: Record<string, string> = {
  Jedzenie: 'cat-jedzenie',
  Transport: 'cat-transport',
  Mieszkanie: 'cat-mieszkanie',
  Rozrywka: 'cat-rozrywka',
  Zdrowie: 'cat-zdrowie',
  Edukacja: 'cat-edukacja',
  Subskrypcje: 'cat-subskrypcje',
  Inne: 'cat-inne',
};

const newId = (name: string) => SYSTEM_CATEGORIES.find((c) => c.name === name)!.id;

/**
 * Wykonuje prawdziwy plik migracji na bazie testowej. global-setup nałożył
 * go już na pustą bazę (wtedy nic nie robi); tu puszczamy go drugi raz na
 * danych w starym formacie — dokładnie tak, jak trafi na bazę deweloperską.
 */
async function runCategoryIdMigration(): Promise<void> {
  const dir = join(import.meta.dirname, '../prisma/migrations');
  const name = readdirSync(dir).find((entry) => entry.endsWith('_system_category_uuids'));
  if (!name) throw new Error('Brak migracji *_system_category_uuids');
  const sql = readFileSync(join(dir, name, 'migration.sql'), 'utf8');

  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

describe('Seed kategorii systemowych (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let me: TestSession;

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${me.accessToken}` });

  beforeAll(async () => {
    app = await createTestApp();
    db = createTestDb();
  });

  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(db);
    me = await registerUser(app);
  });

  it('po seedzie GET /categories zwraca 200 i wszystkie kategorie systemowe', async () => {
    await seedSystemCategories(db);

    const res = await http().get('/categories').set(auth()).expect(200);

    expect(res.body).toHaveLength(SYSTEM_CATEGORIES.length);
    expect(res.body).toEqual(
      expect.arrayContaining(SYSTEM_CATEGORIES.map((c) => ({ ...c, isSystem: true }))),
    );
  });

  it('seed można uruchomić wielokrotnie — bez duplikatów', async () => {
    await seedSystemCategories(db);
    await seedSystemCategories(db);

    expect(await db.category.count({ where: { userId: null } })).toBe(SYSTEM_CATEGORIES.length);
  });

  it('wydatek można przypisać do kategorii systemowej z seeda', async () => {
    await seedSystemCategories(db);

    const res = await http()
      .post('/transactions')
      .set(auth())
      .send({ amount: 4_590, date: '2026-09-27', categoryId: newId('Jedzenie') })
      .expect(201);

    expect(res.body.categoryId).toBe(newId('Jedzenie'));
  });

  describe('migracja id kategorii systemowych na UUID', () => {
    /**
     * Stan bazy deweloperskiej sprzed poprawki: stare id oraz wydatki
     * i reguły, które na nie wskazują (wstawione wprost do bazy — API
     * odrzuciłoby takie categoryId).
     */
    async function seedLegacyData() {
      await db.category.createMany({
        data: SYSTEM_CATEGORIES.map(({ name, icon, color }) => ({
          id: LEGACY_IDS[name]!,
          name,
          icon,
          color,
          userId: null,
        })),
      });
      const own = await db.category.create({
        data: { userId: me.user.id, name: 'Hobby', icon: 'star', color: '#123456' },
      });
      const food = await db.transaction.create({
        data: {
          userId: me.user.id,
          amount: 4_590,
          date: new Date('2026-09-27'),
          categoryId: 'cat-jedzenie',
        },
      });
      // W koszu też — po przywróceniu nie może wrócić bez kategorii.
      const trashed = await db.transaction.create({
        data: {
          userId: me.user.id,
          amount: 1_000,
          date: new Date('2026-09-20'),
          categoryId: 'cat-inne',
          deletedAt: new Date(),
        },
      });
      const hobby = await db.transaction.create({
        data: {
          userId: me.user.id,
          amount: 2_000,
          date: new Date('2026-09-21'),
          categoryId: own.id,
        },
      });
      const rule = await db.recurringRule.create({
        data: {
          userId: me.user.id,
          kind: 'EXPENSE',
          name: 'Bilet miesięczny',
          frequency: 'MONTHLY',
          startDate: new Date('2026-01-10'),
          dayOfMonth: 10,
          categoryId: 'cat-transport',
        },
      });
      return { own, food, trashed, hobby, rule };
    }

    async function categoryOf(transactionId: string) {
      return (await db.transaction.findUniqueOrThrow({ where: { id: transactionId } })).categoryId;
    }

    it('przepisuje id na UUID razem z odwołaniami — nic nie traci kategorii', async () => {
      const { own, food, trashed, hobby, rule } = await seedLegacyData();

      await runCategoryIdMigration();

      const system = await db.category.findMany({ where: { userId: null } });
      expect(system.map((c) => c.id).sort()).toEqual(SYSTEM_CATEGORIES.map((c) => c.id).sort());
      expect(await categoryOf(food.id)).toBe(newId('Jedzenie'));
      expect(await categoryOf(trashed.id)).toBe(newId('Inne'));
      expect(
        (await db.recurringRule.findUniqueOrThrow({ where: { id: rule.id } })).categoryId,
      ).toBe(newId('Transport'));
      // Własne kategorie użytkownika zostają nietknięte.
      expect(await categoryOf(hobby.id)).toBe(own.id);
      await http().get('/categories').set(auth()).expect(200);
    });

    it('działa też, gdy nowy seed uruchomiono przed migracją (oba zestawy w bazie)', async () => {
      const { own, food, trashed, hobby, rule } = await seedLegacyData();
      await seedSystemCategories(db);

      await runCategoryIdMigration();

      expect(await db.category.count({ where: { userId: null } })).toBe(SYSTEM_CATEGORIES.length);
      expect(await db.category.count({ where: { id: { startsWith: 'cat-' } } })).toBe(0);
      expect(await categoryOf(food.id)).toBe(newId('Jedzenie'));
      expect(await categoryOf(trashed.id)).toBe(newId('Inne'));
      // DELETE starych wierszy nie może zahaczyć o kategorie użytkownika.
      expect(await categoryOf(hobby.id)).toBe(own.id);
      expect(await db.category.findUnique({ where: { id: own.id } })).not.toBeNull();
      expect(
        (await db.recurringRule.findUniqueOrThrow({ where: { id: rule.id } })).categoryId,
      ).toBe(newId('Transport'));
    });

    it('na bazie bez starych id niczego nie zmienia', async () => {
      await seedSystemCategories(db);
      const before = await db.category.findMany({ orderBy: { id: 'asc' } });

      await runCategoryIdMigration();

      expect(await db.category.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    });
  });
});
