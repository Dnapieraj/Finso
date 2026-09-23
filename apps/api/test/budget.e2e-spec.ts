import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { Clock } from '../src/common/clock.js';
import { CLOCK } from '../src/common/clock.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { TestSession } from './helpers.js';
import { createTestApp, createTestDb, registerUser, resetDb } from './helpers.js';

/**
 * Logikę liczenia testuje @vireo/shared. Tu sprawdzamy klejenie: że API
 * ładuje właściwe dane (własne, nieusunięte, z bieżącego okresu), liczy
 * "dziś" w strefie użytkownika i zwraca wynik silnika bez przekłamań.
 */

/** Zegar, który test może przestawić — np. na noc zmiany czasu. */
class TestClock implements Clock {
  private current = new Date();

  now(): Date {
    return this.current;
  }

  set(iso: string): void {
    this.current = new Date(iso);
  }
}

const clock = new TestClock();

describe('Budget (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let me: TestSession;

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });
  const post = (session: TestSession, path: string, body: object) =>
    http().post(path).set(as(session)).send(body).expect(201);
  const current = (session: TestSession = me) =>
    http().get('/budget/current').set(as(session)).expect(200);

  /**
   * Typowy użytkownik: pensja 8000 zł 10. dnia, czynsz 2500 zł 10. dnia,
   * cel 1000 zł do końca listopada, jedna kawa 12,99 zł.
   */
  async function seedTypicalUser(session: TestSession): Promise<{ rentRuleId: string; goalId: string }> {
    const salaryRule = await post(session, '/recurring-rules', {
      kind: 'INCOME',
      frequency: 'MONTHLY',
      startDate: '2026-01-10',
      dayOfMonth: 10,
    });
    await post(session, '/income/sources', {
      name: 'Pensja',
      kind: 'REGULAR',
      expectedAmount: 800_000,
      recurringRuleId: salaryRule.body.id,
    });
    const rent = await post(session, '/recurring-rules', {
      kind: 'EXPENSE',
      name: 'Czynsz',
      frequency: 'MONTHLY',
      startDate: '2026-01-10',
      dayOfMonth: 10,
      expectedAmount: 250_000,
    });
    const goal = await post(session, '/goals', {
      name: 'Wakacje',
      targetAmount: 100_000,
      targetDate: '2026-11-30',
    });
    await post(session, '/transactions', { amount: 1_299, date: '2026-09-20' });
    return { rentRuleId: rent.body.id, goalId: goal.body.id };
  }

  beforeAll(async () => {
    app = await createTestApp((builder) => builder.overrideProvider(CLOCK).useValue(clock));
    db = createTestDb();
  });

  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(db);
    // Środa 23.09.2026, 12:00 w Warszawie.
    clock.set('2026-09-23T10:00:00Z');
    me = await registerUser(app);
  });

  describe('GET /budget/current', () => {
    it('nowy użytkownik: zerowy dochód, zero do wydania', async () => {
      const res = await current();
      expect(res.body).toEqual({
        period: { start: '2026-09-01', end: '2026-09-30' },
        asOf: '2026-09-23',
        availableBalance: 0,
        daysRemaining: 8,
        dailyAllowance: 0,
        breakdown: { periodIncome: 0, fixedCommitments: 0, goalContributions: 0, alreadySpent: 0 },
        fixedCommitments: [],
        goalContributions: [],
      });
    });

    it('typowy miesiąc: dochód − czynsz − rata celu − wydatki', async () => {
      const { goalId } = await seedTypicalUser(me);

      const res = await current();
      // Rata celu: 100 000 / 3 okresy (wrz, paź, lis) → ceil = 33 334.
      // 800 000 − 250 000 − 33 334 − 1 299 = 515 367; /8 dni → floor 64 420.
      expect(res.body).toMatchObject({
        availableBalance: 515_367,
        daysRemaining: 8,
        dailyAllowance: 64_420,
        breakdown: {
          periodIncome: 800_000,
          fixedCommitments: 250_000,
          goalContributions: 33_334,
          alreadySpent: 1_299,
        },
        fixedCommitments: [{ label: 'Czynsz', amount: 250_000 }],
        goalContributions: [{ goalId, amount: 33_334 }],
      });
    });

    it('opłacenie czynszu nie zmienia salda — nie liczymy go podwójnie', async () => {
      const { rentRuleId } = await seedTypicalUser(me);
      await post(me, '/transactions', {
        amount: 250_000,
        date: '2026-09-10',
        recurringRuleId: rentRuleId,
      });

      const res = await current();
      expect(res.body.fixedCommitments).toEqual([]);
      expect(res.body.breakdown.alreadySpent).toBe(251_299);
      expect(res.body.availableBalance).toBe(515_367);
    });

    it('usunięta transakcja przestaje się liczyć, przywrócona wraca', async () => {
      const tx = await post(me, '/transactions', { amount: 10_000, date: '2026-09-20' });
      expect((await current()).body.breakdown.alreadySpent).toBe(10_000);

      await http().delete(`/transactions/${tx.body.id}`).set(as(me)).expect(204);
      expect((await current()).body.breakdown.alreadySpent).toBe(0);

      await http().post(`/transactions/${tx.body.id}/restore`).set(as(me)).expect(200);
      expect((await current()).body.breakdown.alreadySpent).toBe(10_000);
    });

    it('usunięty wpływ przestaje się liczyć do dochodu', async () => {
      const source = await post(me, '/income/sources', { name: 'Zlecenia', kind: 'IRREGULAR' });
      const entry = await post(me, '/income/entries', {
        incomeSourceId: source.body.id,
        amount: 150_000,
        date: '2026-09-05',
      });
      expect((await current()).body.breakdown.periodIncome).toBe(150_000);

      await http().delete(`/income/entries/${entry.body.id}`).set(as(me)).expect(204);
      expect((await current()).body.breakdown.periodIncome).toBe(0);
    });

    it('okres liczony od dnia wypłaty użytkownika', async () => {
      await http().patch('/users/me').set(as(me)).send({ periodStartDay: 10 }).expect(200);

      const res = await current();
      expect(res.body.period).toEqual({ start: '2026-09-10', end: '2026-10-09' });
      expect(res.body.daysRemaining).toBe(17); // 23.09–09.10 włącznie
    });

    it('dane innego użytkownika nie wpływają na budżet', async () => {
      const other = await registerUser(app);
      await seedTypicalUser(other);

      const res = await current(me);
      expect(res.body.breakdown).toEqual({
        periodIncome: 0,
        fixedCommitments: 0,
        goalContributions: 0,
        alreadySpent: 0,
      });
    });
  });

  describe('"dziś" w strefie użytkownika', () => {
    it('30.09 22:30 UTC: w Warszawie to już 1.10 — nowy okres', async () => {
      clock.set('2026-09-30T22:30:00Z');
      const res = await current();
      expect(res.body.asOf).toBe('2026-10-01');
      expect(res.body.period).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    });

    it('ten sam moment w Nowym Jorku to jeszcze 30.09 — ostatni dzień okresu', async () => {
      await http().patch('/users/me').set(as(me)).send({ timezone: 'America/New_York' }).expect(200);
      clock.set('2026-09-30T22:30:00Z');

      const res = await current();
      expect(res.body.asOf).toBe('2026-09-30');
      expect(res.body.daysRemaining).toBe(1);
    });

    it('po zmianie czasu na zimowy (25.10 22:30 UTC) w Warszawie to wciąż 25.10', async () => {
      clock.set('2026-10-25T22:30:00Z');
      const res = await current();
      expect(res.body.asOf).toBe('2026-10-25');
      expect(res.body.daysRemaining).toBe(7); // 25–31.10
    });
  });

  describe('POST /budget/simulate', () => {
    let categoryId: string;

    beforeEach(async () => {
      const category = await post(me, '/categories', { name: 'Zakupy', icon: 'bag', color: '#336699' });
      categoryId = category.body.id;
    });

    it('drobny zakup: stać, ryzyko safe, pokazuje stan przed i po', async () => {
      await seedTypicalUser(me);

      const res = await http()
        .post('/budget/simulate')
        .set(as(me))
        .send({ amount: 10_000, categoryId })
        .expect(200);
      // 515 367 − 10 000 = 505 367; /8 → 63 170.
      expect(res.body).toMatchObject({
        canAfford: true,
        riskLevel: 'safe',
        before: { availableBalance: 515_367, dailyAllowance: 64_420 },
        remainingAfter: 505_367,
        dailyAllowanceAfter: 63_170,
      });
    });

    it('zakup ponad stan: nie stać, pokazuje opóźnienie celu', async () => {
      const { goalId } = await seedTypicalUser(me);

      const res = await http()
        .post('/budget/simulate')
        .set(as(me))
        .send({ amount: 600_000, categoryId })
        .expect(200);
      // Deficyt 84 633, cel dostaje 33 334/okres → dotknięte 33 334.
      // Brakuje 100 000 na 68 dni (23.09–30.11) → ceil(33 334 / (100 000/68)) = 23.
      expect(res.body).toMatchObject({
        canAfford: false,
        riskLevel: 'over',
        remainingAfter: -84_633,
        goalImpacts: [{ goalId, delayDays: 23 }],
      });
    });

    it('symulacja niczego nie zapisuje', async () => {
      await http().post('/budget/simulate').set(as(me)).send({ amount: 10_000, categoryId }).expect(200);
      expect(await db.transaction.count()).toBe(0);
    });

    it('wymaga kategorii i dodatniej kwoty w groszach', async () => {
      await http().post('/budget/simulate').set(as(me)).send({ amount: 10_000 }).expect(400);
      await http().post('/budget/simulate').set(as(me)).send({ amount: 0, categoryId }).expect(400);
      await http().post('/budget/simulate').set(as(me)).send({ amount: 99.5, categoryId }).expect(400);
    });

    it('nie przyjmuje kategorii innego użytkownika', async () => {
      const other = await registerUser(app);
      const foreign = await post(other, '/categories', { name: 'X', icon: 'x', color: '#000000' });

      await http()
        .post('/budget/simulate')
        .set(as(me))
        .send({ amount: 100, categoryId: foreign.body.id })
        .expect(400);
    });
  });
});
