import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { TestSession } from './helpers.js';
import { createTestApp, createTestDb, registerUser, resetDb } from './helpers.js';

/**
 * Izolacja danych między użytkownikami — dla KAŻDEGO zasobu te same
 * asercje: Alice nie widzi, nie edytuje, nie usuwa i nie przywraca
 * zasobów Boba, a próba kończy się tym samym 404 co dla nieistniejącego
 * id (odpowiedź nie zdradza, że cudzy zasób istnieje).
 *
 * Nowy moduł CRUD = nowy wiersz w `resources`.
 */

interface ResourceCase {
  name: string;
  path: string;
  /** Tworzy zasób jako `owner` przez API i zwraca jego id. */
  create: (owner: TestSession) => Promise<string>;
  /** Poprawne body PATCH — musi przejść walidację, żeby test sprawdzał autoryzację, nie Zoda. */
  patch: Record<string, unknown>;
  /** Jak policzyć ten zasób w bazie — do sprawdzenia, że nic się nie zmieniło. */
  snapshot: (db: PrismaClient, id: string) => Promise<unknown>;
  /** Lista zwraca stronę `{ items }` zamiast tablicy. */
  paginated?: boolean;
  /** Ma endpoint POST /:id/restore (miękkie usuwanie). */
  restorable?: boolean;
}

describe('Izolacja danych między użytkownikami (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let alice: TestSession;
  let bob: TestSession;

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });

  async function post(owner: TestSession, path: string, body: object): Promise<string> {
    const res = await http().post(path).set(as(owner)).send(body).expect(201);
    return (res.body as { id: string }).id;
  }

  const createRule = (owner: TestSession, kind: 'INCOME' | 'EXPENSE') =>
    post(owner, '/recurring-rules', {
      kind,
      frequency: 'MONTHLY',
      startDate: '2026-01-10',
      dayOfMonth: 10,
      expectedAmount: kind === 'EXPENSE' ? 5_000 : null,
    });

  const createSource = (owner: TestSession) =>
    post(owner, '/income/sources', { name: 'Pensja', kind: 'REGULAR', expectedAmount: 800_000 });

  const resources: ResourceCase[] = [
    {
      name: 'categories',
      path: '/categories',
      create: (o) => post(o, '/categories', { name: 'Hobby', icon: 'star', color: '#123456' }),
      patch: { name: 'Przejęta' },
      snapshot: (d, id) => d.category.findUnique({ where: { id } }),
    },
    {
      name: 'transactions',
      path: '/transactions',
      create: (o) => post(o, '/transactions', { amount: 4_999, date: '2026-09-12' }),
      patch: { amount: 1 },
      snapshot: (d, id) => d.transaction.findUnique({ where: { id } }),
      paginated: true,
      restorable: true,
    },
    {
      name: 'goals',
      path: '/goals',
      create: (o) =>
        post(o, '/goals', { name: 'Wakacje', targetAmount: 500_000, targetDate: '2027-06-01' }),
      patch: { currentAmount: 0 },
      snapshot: (d, id) => d.goal.findUnique({ where: { id } }),
      restorable: true,
    },
    {
      name: 'income sources',
      path: '/income/sources',
      create: createSource,
      patch: { name: 'Przejęta' },
      snapshot: (d, id) => d.incomeSource.findUnique({ where: { id } }),
    },
    {
      name: 'income entries',
      path: '/income/entries',
      create: async (o) =>
        post(o, '/income/entries', {
          incomeSourceId: await createSource(o),
          amount: 800_000,
          date: '2026-09-10',
        }),
      patch: { amount: 1 },
      snapshot: (d, id) => d.incomeEntry.findUnique({ where: { id } }),
      paginated: true,
    },
    {
      name: 'recurring rules',
      path: '/recurring-rules',
      create: (o) => createRule(o, 'EXPENSE'),
      patch: { isActive: false },
      snapshot: (d, id) => d.recurringRule.findUnique({ where: { id } }),
    },
  ];

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
    alice = await registerUser(app);
    bob = await registerUser(app);
  });

  describe.each(resources)('$name', (resource) => {
    let bobsId: string;
    let before: unknown;

    beforeEach(async () => {
      bobsId = await resource.create(bob);
      before = await resource.snapshot(db, bobsId);
    });

    afterEach(async () => {
      // Po każdej próbie Alice zasób Boba ma być bit w bit taki sam.
      expect(await resource.snapshot(db, bobsId)).toEqual(before);
    });

    it('lista Alice nie zawiera zasobu Boba', async () => {
      const res = await http().get(resource.path).set(as(alice)).expect(200);
      const items = (resource.paginated ? res.body.items : res.body) as { id: string }[];
      expect(items.map((item) => item.id)).not.toContain(bobsId);
    });

    it('GET /:id → 404, tak samo jak dla nieistniejącego id', async () => {
      const foreign = await http().get(`${resource.path}/${bobsId}`).set(as(alice)).expect(404);
      const missing = await http()
        .get(`${resource.path}/01a0cf55-0000-7000-8000-000000000000`)
        .set(as(alice))
        .expect(404);
      expect(foreign.body).toEqual(missing.body);
    });

    it('PATCH /:id → 404', async () => {
      await http().patch(`${resource.path}/${bobsId}`).set(as(alice)).send(resource.patch).expect(404);
    });

    it('DELETE /:id → 404', async () => {
      await http().delete(`${resource.path}/${bobsId}`).set(as(alice)).expect(404);
    });

    it('właściciel nadal ma pełny dostęp (kontrola, że test nie przechodzi "na pusto")', async () => {
      await http().get(`${resource.path}/${bobsId}`).set(as(bob)).expect(200);
    });

    if (resource.restorable) {
      it('POST /:id/restore na usuniętym zasobie Boba → 404', async () => {
        await http().delete(`${resource.path}/${bobsId}`).set(as(bob)).expect(204);
        before = await resource.snapshot(db, bobsId);

        await http().post(`${resource.path}/${bobsId}/restore`).set(as(alice)).expect(404);
      });
    }
  });

  describe('referencje w body do cudzych zasobów', () => {
    // Filtr userId na zapisywanym wierszu tego nie łapie — klucz obcy
    // przyjąłby cudze id bez błędu.
    const expectUnknownReference = (res: request.Response, field: string) => {
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([
        expect.objectContaining({ code: 'unknown_reference', path: [field] }),
      ]);
    };

    it('transakcja z kategorią Boba', async () => {
      const bobsCategory = await post(bob, '/categories', { name: 'X', icon: 'x', color: '#000000' });
      const res = await http()
        .post('/transactions')
        .set(as(alice))
        .send({ amount: 100, date: '2026-09-12', categoryId: bobsCategory });
      expectUnknownReference(res, 'categoryId');
    });

    it('zmiana kategorii istniejącej transakcji na kategorię Boba', async () => {
      const bobsCategory = await post(bob, '/categories', { name: 'X', icon: 'x', color: '#000000' });
      const mine = await post(alice, '/transactions', { amount: 100, date: '2026-09-12' });
      const res = await http()
        .patch(`/transactions/${mine}`)
        .set(as(alice))
        .send({ categoryId: bobsCategory });
      expectUnknownReference(res, 'categoryId');
    });

    it('transakcja z regułą cykliczną Boba', async () => {
      const bobsRule = await createRule(bob, 'EXPENSE');
      const res = await http()
        .post('/transactions')
        .set(as(alice))
        .send({ amount: 100, date: '2026-09-12', recurringRuleId: bobsRule });
      expectUnknownReference(res, 'recurringRuleId');
    });

    it('wpływ do źródła dochodu Boba', async () => {
      const bobsSource = await createSource(bob);
      const res = await http()
        .post('/income/entries')
        .set(as(alice))
        .send({ incomeSourceId: bobsSource, amount: 100, date: '2026-09-10' });
      expectUnknownReference(res, 'incomeSourceId');
    });

    it('źródło dochodu podpięte pod regułę Boba', async () => {
      const bobsRule = await createRule(bob, 'INCOME');
      const res = await http()
        .post('/income/sources')
        .set(as(alice))
        .send({ name: 'X', kind: 'REGULAR', expectedAmount: 100, recurringRuleId: bobsRule });
      expectUnknownReference(res, 'recurringRuleId');
    });

    it('reguła wydatku z kategorią Boba', async () => {
      const bobsCategory = await post(bob, '/categories', { name: 'X', icon: 'x', color: '#000000' });
      const res = await http().post('/recurring-rules').set(as(alice)).send({
        kind: 'EXPENSE',
        frequency: 'MONTHLY',
        startDate: '2026-01-10',
        dayOfMonth: 10,
        expectedAmount: 100,
        categoryId: bobsCategory,
      });
      expectUnknownReference(res, 'categoryId');
    });
  });

  describe('filtry i kursory z cudzymi id', () => {
    it('filtr po kategorii Boba nie zwraca transakcji Boba', async () => {
      const bobsCategory = await post(bob, '/categories', { name: 'X', icon: 'x', color: '#000000' });
      await post(bob, '/transactions', { amount: 100, date: '2026-09-12', categoryId: bobsCategory });

      const res = await http()
        .get('/transactions')
        .query({ categoryId: bobsCategory })
        .set(as(alice))
        .expect(200);
      expect(res.body.items).toEqual([]);
    });

    it('filtr po źródle Boba nie zwraca wpływów Boba', async () => {
      const bobsSource = await createSource(bob);
      await post(bob, '/income/entries', { incomeSourceId: bobsSource, amount: 100, date: '2026-09-10' });

      const res = await http()
        .get('/income/entries')
        .query({ incomeSourceId: bobsSource })
        .set(as(alice))
        .expect(200);
      expect(res.body.items).toEqual([]);
    });

    it('kursor wskazujący transakcję Boba → 400', async () => {
      const bobsTx = await post(bob, '/transactions', { amount: 100, date: '2026-09-12' });
      await http().get('/transactions').query({ cursor: bobsTx }).set(as(alice)).expect(400);
    });

    it('kursor wskazujący wpływ Boba → 400', async () => {
      const bobsSource = await createSource(bob);
      const bobsEntry = await post(bob, '/income/entries', {
        incomeSourceId: bobsSource,
        amount: 100,
        date: '2026-09-10',
      });
      await http().get('/income/entries').query({ cursor: bobsEntry }).set(as(alice)).expect(400);
    });
  });
});
