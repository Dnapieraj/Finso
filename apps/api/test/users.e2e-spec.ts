import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { TestSession } from './helpers.js';
import { createTestApp, createTestDb, registerUser, resetDb, TEST_PASSWORD } from './helpers.js';

/** Zakłada użytkownikowi po jednym wierszu w każdej tabeli z danymi. */
async function seedUserData(db: PrismaClient, userId: string): Promise<void> {
  const category = await db.category.create({
    data: { userId, name: 'Własna', icon: 'star', color: '#123456' },
  });
  const rule = await db.recurringRule.create({
    data: { userId, kind: 'INCOME', frequency: 'MONTHLY', dayOfMonth: 10 },
  });
  const source = await db.incomeSource.create({
    data: { userId, name: 'Pensja', kind: 'REGULAR', expectedAmount: 800_000, recurringRuleId: rule.id },
  });
  await db.incomeEntry.create({
    data: { userId, incomeSourceId: source.id, amount: 800_000, date: new Date('2026-09-10') },
  });
  await db.transaction.createMany({
    data: [
      { userId, categoryId: category.id, amount: 4_999, date: new Date('2026-09-12') },
      // Miękko usunięta — też musi zniknąć przy usunięciu konta.
      { userId, amount: 1_500, date: new Date('2026-09-13'), deletedAt: new Date() },
    ],
  });
  await db.goal.create({
    data: { userId, name: 'Wakacje', targetAmount: 500_000, targetDate: new Date('2027-06-01') },
  });
}

async function countUserRows(db: PrismaClient, userId: string): Promise<Record<string, number>> {
  const where = { userId };
  return {
    user: await db.user.count({ where: { id: userId } }),
    refreshTokens: await db.refreshToken.count({ where }),
    categories: await db.category.count({ where }),
    recurringRules: await db.recurringRule.count({ where }),
    incomeSources: await db.incomeSource.count({ where }),
    incomeEntries: await db.incomeEntry.count({ where }),
    transactions: await db.transaction.count({ where }),
    goals: await db.goal.count({ where }),
  };
}

describe('Users (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;

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
  });

  const http = () => request(app.getHttpServer());
  const auth = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });

  describe('GET /users/me', () => {
    it('zwraca tylko dane zalogowanego użytkownika', async () => {
      const alice = await registerUser(app, 'alice@example.com');
      await registerUser(app, 'bob@example.com');

      const res = await http().get('/users/me').set(auth(alice)).expect(200);

      expect(res.body).toEqual({
        id: alice.user.id,
        email: 'alice@example.com',
        plan: 'FREE',
        currency: 'PLN',
        timezone: 'Europe/Warsaw',
      });
    });
  });

  describe('DELETE /users/me', () => {
    it('usuwa konto i WSZYSTKIE dane użytkownika, także miękko usunięte', async () => {
      const session = await registerUser(app);
      await seedUserData(db, session.user.id);

      const before = await countUserRows(db, session.user.id);
      expect(Object.values(before).every((count) => count > 0)).toBe(true);

      await http().delete('/users/me').set(auth(session)).send({ password: TEST_PASSWORD }).expect(204);

      expect(await countUserRows(db, session.user.id)).toEqual({
        user: 0,
        refreshTokens: 0,
        categories: 0,
        recurringRules: 0,
        incomeSources: 0,
        incomeEntries: 0,
        transactions: 0,
        goals: 0,
      });
    });

    it('nie rusza danych innych użytkowników ani kategorii systemowych', async () => {
      const alice = await registerUser(app);
      const bob = await registerUser(app);
      await seedUserData(db, alice.user.id);
      await seedUserData(db, bob.user.id);
      await db.category.create({ data: { userId: null, name: 'Jedzenie', icon: 'food', color: '#00aa00' } });
      const bobBefore = await countUserRows(db, bob.user.id);

      await http().delete('/users/me').set(auth(alice)).send({ password: TEST_PASSWORD }).expect(204);

      expect(await countUserRows(db, bob.user.id)).toEqual(bobBefore);
      expect(await db.category.count({ where: { userId: null } })).toBe(1);
    });

    it('po usunięciu konta stare tokeny i dane logowania przestają działać', async () => {
      const session = await registerUser(app, 'deleted@example.com');

      await http().delete('/users/me').set(auth(session)).send({ password: TEST_PASSWORD }).expect(204);

      // Access token ma jeszcze ważny podpis, ale konta już nie ma.
      await http().get('/users/me').set(auth(session)).expect(401);
      await http().post('/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
      await http()
        .post('/auth/login')
        .send({ email: 'deleted@example.com', password: TEST_PASSWORD })
        .expect(401);
    });

    it('można ponownie założyć konto na ten sam e-mail', async () => {
      const session = await registerUser(app, 'again@example.com');
      await http().delete('/users/me').set(auth(session)).send({ password: TEST_PASSWORD }).expect(204);

      await registerUser(app, 'again@example.com');
    });

    it('wymaga poprawnego hasła — skradziony access token nie wystarczy', async () => {
      const session = await registerUser(app);
      await seedUserData(db, session.user.id);

      await http().delete('/users/me').set(auth(session)).send({ password: 'wrong password' }).expect(401);

      expect((await countUserRows(db, session.user.id)).transactions).toBe(2);
    });

    it('odrzuca żądanie bez hasła (400) i bez tokena (401)', async () => {
      const session = await registerUser(app);

      await http().delete('/users/me').set(auth(session)).send({}).expect(400);
      await http().delete('/users/me').send({ password: TEST_PASSWORD }).expect(401);
      expect(await db.user.count({ where: { id: session.user.id } })).toBe(1);
    });
  });
});
