import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { TestSession } from './helpers.js';
import { createTestApp, createTestDb, registerUser, resetDb } from './helpers.js';

describe('Moduły CRUD (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let me: TestSession;

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${me.accessToken}` });
  const get = (path: string) => http().get(path).set(auth());
  const post = (path: string, body: object = {}) => http().post(path).set(auth()).send(body);
  const patch = (path: string, body: object) => http().patch(path).set(auth()).send(body);
  const del = (path: string) => http().delete(path).set(auth());

  const issuePaths = (res: request.Response) =>
    (res.body.errors as { path: string[]; message: string }[]).map(
      (e) => `${e.path.join('.')}:${e.message}`,
    );

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

  describe('/users/me', () => {
    it('PATCH ustawia strefę czasową i dzień startu okresu', async () => {
      const res = await patch('/users/me', { timezone: 'America/New_York', periodStartDay: 10 }).expect(
        200,
      );
      expect(res.body).toMatchObject({ timezone: 'America/New_York', periodStartDay: 10 });
    });

    it('odrzuca dzień 29+ i nieznaną strefę', async () => {
      await patch('/users/me', { periodStartDay: 29 }).expect(400);
      await patch('/users/me', { timezone: 'Europe/Atlantis' }).expect(400);
    });
  });

  describe('/categories', () => {
    it('lista zawiera kategorie systemowe oznaczone isSystem', async () => {
      await db.category.create({ data: { userId: null, name: 'Jedzenie', icon: 'food', color: '#00aa00' } });
      await post('/categories', { name: 'Hobby', icon: 'star', color: '#123456' }).expect(201);

      const res = await get('/categories').expect(200);
      expect(res.body).toEqual([
        expect.objectContaining({ name: 'Hobby', isSystem: false }),
        expect.objectContaining({ name: 'Jedzenie', isSystem: true }),
      ]);
    });

    it('kategorii systemowej nie da się edytować ani usunąć', async () => {
      const system = await db.category.create({
        data: { userId: null, name: 'Jedzenie', icon: 'food', color: '#00aa00' },
      });
      await get(`/categories/${system.id}`).expect(200);
      await patch(`/categories/${system.id}`, { name: 'Moje' }).expect(404);
      await del(`/categories/${system.id}`).expect(404);
    });

    it('transakcja może używać kategorii systemowej', async () => {
      const system = await db.category.create({
        data: { userId: null, name: 'Jedzenie', icon: 'food', color: '#00aa00' },
      });
      await post('/transactions', { amount: 100, date: '2026-09-12', categoryId: system.id }).expect(201);
    });

    it('usunięcie kategorii zostawia transakcje bez kategorii', async () => {
      const category = await post('/categories', { name: 'Hobby', icon: 'star', color: '#123456' });
      const tx = await post('/transactions', {
        amount: 100,
        date: '2026-09-12',
        categoryId: category.body.id,
      });

      await del(`/categories/${category.body.id}`).expect(204);

      const res = await get(`/transactions/${tx.body.id}`).expect(200);
      expect(res.body.categoryId).toBeNull();
    });
  });

  describe('/transactions', () => {
    it('tworzy wydatek z domyślnym statusem CONFIRMED', async () => {
      const res = await post('/transactions', { amount: 4_999, date: '2026-09-12' }).expect(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        amount: 4_999,
        date: '2026-09-12',
        categoryId: null,
        recurringRuleId: null,
        note: null,
        status: 'CONFIRMED',
      });
    });

    it.each([
      ['ułamek grosza', { amount: 12.5, date: '2026-09-12' }],
      ['zero', { amount: 0, date: '2026-09-12' }],
      ['kwota ujemna', { amount: -100, date: '2026-09-12' }],
      ['kwota ponad int4', { amount: 2_147_483_648, date: '2026-09-12' }],
      ['29 lutego w roku nieprzestępnym', { amount: 100, date: '2025-02-29' }],
      ['data z czasem', { amount: 100, date: '2026-09-12T10:00:00Z' }],
    ])('odrzuca: %s', async (_label, body) => {
      await post('/transactions', body).expect(400);
    });

    it('przyjmuje 29 lutego w roku przestępnym', async () => {
      const res = await post('/transactions', { amount: 100, date: '2028-02-29' }).expect(201);
      expect(res.body.date).toBe('2028-02-29');
    });

    it('PATCH zmienia tylko podane pola (nie resetuje statusu)', async () => {
      const tx = await post('/transactions', { amount: 100, date: '2026-09-12', status: 'PENDING' });
      const res = await patch(`/transactions/${tx.body.id}`, { note: 'kawa' }).expect(200);
      expect(res.body).toMatchObject({ note: 'kawa', status: 'PENDING', amount: 100 });
    });

    it('stronicuje kursorem od najnowszych, bez duplikatów przy tej samej dacie', async () => {
      const dates = ['2026-09-01', '2026-09-05', '2026-09-05', '2026-09-05', '2026-09-10'];
      for (const date of dates) await post('/transactions', { amount: 100, date }).expect(201);

      const seen: string[] = [];
      const seenDates: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const res = await get('/transactions')
          .query({ limit: 2, ...(cursor ? { cursor } : {}) })
          .expect(200);
        for (const item of res.body.items as { id: string; date: string }[]) {
          seen.push(item.id);
          seenDates.push(item.date);
        }
        cursor = res.body.nextCursor ?? undefined;
        pages += 1;
      } while (cursor);

      expect(pages).toBe(3);
      expect(new Set(seen).size).toBe(5);
      expect(seenDates).toEqual([...dates].reverse());
    });

    it('filtruje po zakresie dat włącznie z granicami', async () => {
      for (const date of ['2026-08-31', '2026-09-01', '2026-09-30', '2026-10-01']) {
        await post('/transactions', { amount: 100, date }).expect(201);
      }
      const res = await get('/transactions').query({ from: '2026-09-01', to: '2026-09-30' }).expect(200);
      expect((res.body.items as { date: string }[]).map((t) => t.date)).toEqual([
        '2026-09-30',
        '2026-09-01',
      ]);
    });

    it('usunięcie jest miękkie i odwracalne', async () => {
      const tx = await post('/transactions', { amount: 100, date: '2026-09-12' });
      const id = tx.body.id as string;

      await del(`/transactions/${id}`).expect(204);
      await get(`/transactions/${id}`).expect(404);
      expect((await get('/transactions').expect(200)).body.items).toEqual([]);
      // Wiersz nadal jest w bazie — tylko z deletedAt.
      expect((await db.transaction.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();

      const restored = await post(`/transactions/${id}/restore`).expect(200);
      expect(restored.body.id).toBe(id);
      await get(`/transactions/${id}`).expect(200);
    });

    it('nie da się edytować ani drugi raz usunąć transakcji z kosza', async () => {
      const tx = await post('/transactions', { amount: 100, date: '2026-09-12' });
      await del(`/transactions/${tx.body.id}`).expect(204);

      await patch(`/transactions/${tx.body.id}`, { amount: 1 }).expect(404);
      await del(`/transactions/${tx.body.id}`).expect(404);
    });

    it('restore transakcji, która nie jest usunięta → 404', async () => {
      const tx = await post('/transactions', { amount: 100, date: '2026-09-12' });
      await post(`/transactions/${tx.body.id}/restore`).expect(404);
    });

    it('wydatek nie podepnie się pod regułę dochodu', async () => {
      const rule = await post('/recurring-rules', {
        kind: 'INCOME',
        frequency: 'MONTHLY',
        startDate: '2026-01-10',
        dayOfMonth: 10,
      });
      const res = await post('/transactions', {
        amount: 100,
        date: '2026-09-12',
        recurringRuleId: rule.body.id,
      }).expect(400);
      expect(issuePaths(res)).toEqual(['recurringRuleId:unknown_reference']);
    });
  });

  describe('/goals', () => {
    it('nowy cel startuje od 0, termin w przeszłości jest dozwolony', async () => {
      const res = await post('/goals', {
        name: 'Zaległy',
        targetAmount: 100_000,
        targetDate: '2020-01-01',
      }).expect(201);
      expect(res.body).toMatchObject({ currentAmount: 0, targetDate: '2020-01-01' });
    });

    it('usunięcie jest miękkie i odwracalne', async () => {
      const goal = await post('/goals', { name: 'W', targetAmount: 100, targetDate: '2027-01-01' });
      await del(`/goals/${goal.body.id}`).expect(204);
      expect((await get('/goals').expect(200)).body).toEqual([]);

      await post(`/goals/${goal.body.id}/restore`).expect(200);
      expect((await get('/goals').expect(200)).body).toHaveLength(1);
    });
  });

  describe('/recurring-rules', () => {
    const monthly = {
      kind: 'EXPENSE',
      name: 'Czynsz',
      frequency: 'MONTHLY',
      startDate: '2026-01-10',
      dayOfMonth: 10,
      expectedAmount: 250_000,
    };

    it('odrzuca niespójną regułę przy tworzeniu', async () => {
      const res = await post('/recurring-rules', { ...monthly, dayOfMonth: null }).expect(400);
      expect(issuePaths(res)).toEqual(['dayOfMonth:required_for_monthly_and_yearly']);
    });

    it('PATCH jest walidowany po scaleniu ze stanem z bazy', async () => {
      const rule = await post('/recurring-rules', monthly).expect(201);

      // Sama zmiana na WEEKLY: w bazie zostaje dayOfMonth, brakuje dayOfWeek.
      const res = await patch(`/recurring-rules/${rule.body.id}`, { frequency: 'WEEKLY' }).expect(400);
      expect(issuePaths(res)).toEqual([
        'dayOfWeek:required_for_weekly',
        'dayOfMonth:not_allowed_for_weekly',
      ]);

      const ok = await patch(`/recurring-rules/${rule.body.id}`, {
        frequency: 'WEEKLY',
        dayOfWeek: 1,
        dayOfMonth: null,
      }).expect(200);
      expect(ok.body).toMatchObject({ frequency: 'WEEKLY', dayOfWeek: 1, dayOfMonth: null });
    });

    it('wyłączenie reguły zamiast usunięcia', async () => {
      const rule = await post('/recurring-rules', monthly).expect(201);
      const res = await patch(`/recurring-rules/${rule.body.id}`, { isActive: false }).expect(200);
      expect(res.body.isActive).toBe(false);
    });
  });

  describe('/income', () => {
    it('REGULAR wymaga kwoty, IRREGULAR jej nie przyjmuje', async () => {
      await post('/income/sources', { name: 'Pensja', kind: 'REGULAR' }).expect(400);
      await post('/income/sources', { name: 'Zlecenia', kind: 'IRREGULAR', expectedAmount: 1 }).expect(
        400,
      );
    });

    it('PATCH na IRREGULAR bez wyzerowania kwoty → 400', async () => {
      const source = await post('/income/sources', {
        name: 'Pensja',
        kind: 'REGULAR',
        expectedAmount: 800_000,
      });
      const res = await patch(`/income/sources/${source.body.id}`, { kind: 'IRREGULAR' }).expect(400);
      expect(issuePaths(res)).toEqual(['expectedAmount:not_allowed_for_irregular']);

      await patch(`/income/sources/${source.body.id}`, {
        kind: 'IRREGULAR',
        expectedAmount: null,
      }).expect(200);
    });

    it('jedna reguła może opisywać tylko jedno źródło (409)', async () => {
      const rule = await post('/recurring-rules', {
        kind: 'INCOME',
        frequency: 'MONTHLY',
        startDate: '2026-01-10',
        dayOfMonth: 10,
      });
      const body = { kind: 'REGULAR', expectedAmount: 100, recurringRuleId: rule.body.id };
      await post('/income/sources', { ...body, name: 'A' }).expect(201);
      await post('/income/sources', { ...body, name: 'B' }).expect(409);
    });

    it('wpływ domyślnie CONFIRMED; potwierdzenie innej kwoty przez PATCH', async () => {
      const source = await post('/income/sources', { name: 'Zlecenia', kind: 'IRREGULAR' });
      const entry = await post('/income/entries', {
        incomeSourceId: source.body.id,
        amount: 150_000,
        date: '2026-09-10',
        status: 'PENDING',
      }).expect(201);

      const res = await patch(`/income/entries/${entry.body.id}`, {
        status: 'CONFIRMED',
        amount: 142_000,
      }).expect(200);
      expect(res.body).toMatchObject({ status: 'CONFIRMED', amount: 142_000 });

      const manual = await post('/income/entries', {
        incomeSourceId: source.body.id,
        amount: 1,
        date: '2026-09-11',
      });
      expect(manual.body.status).toBe('CONFIRMED');
    });

    it('źródło bez wpływów da się usunąć', async () => {
      const source = await post('/income/sources', { name: 'Pomyłka', kind: 'IRREGULAR' });
      await del(`/income/sources/${source.body.id}`).expect(204);
    });

    it('źródła z wpływami nie da się usunąć — historia zostaje, trzeba zarchiwizować', async () => {
      const source = await post('/income/sources', { name: 'Zlecenia', kind: 'IRREGULAR' });
      await post('/income/entries', { incomeSourceId: source.body.id, amount: 1, date: '2026-09-10' });

      await del(`/income/sources/${source.body.id}`).expect(409);
      expect((await get('/income/entries').expect(200)).body.items).toHaveLength(1);
      await patch(`/income/sources/${source.body.id}`, { isActive: false }).expect(200);
    });

    it('wpływy w koszu też blokują usunięcie źródła (inaczej kaskada skasowałaby kosz)', async () => {
      const source = await post('/income/sources', { name: 'Zlecenia', kind: 'IRREGULAR' });
      const entry = await post('/income/entries', {
        incomeSourceId: source.body.id,
        amount: 1,
        date: '2026-09-10',
      });
      await del(`/income/entries/${entry.body.id}`).expect(204);

      await del(`/income/sources/${source.body.id}`).expect(409);
    });

    it('usunięcie wpływu jest miękkie i odwracalne', async () => {
      const source = await post('/income/sources', { name: 'Zlecenia', kind: 'IRREGULAR' });
      const entry = await post('/income/entries', {
        incomeSourceId: source.body.id,
        amount: 1,
        date: '2026-09-10',
      });
      const id = entry.body.id as string;

      await del(`/income/entries/${id}`).expect(204);
      await get(`/income/entries/${id}`).expect(404);
      await patch(`/income/entries/${id}`, { amount: 2 }).expect(404);
      expect((await db.incomeEntry.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();

      await post(`/income/entries/${id}/restore`).expect(200);
      await get(`/income/entries/${id}`).expect(200);
    });
  });
});
