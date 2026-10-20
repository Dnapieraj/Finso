import type { RecurringRule, SubscriptionsOverviewOutput } from "@vireo/shared";
import request from "supertest";

import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp, TestSession } from "./helpers.js";
import { createTestApp, createTestDb, idOf, registerUser, resetDb, TestClock } from "./helpers.js";

/**
 * Detektor subskrypcji: `GET /subscriptions` liczy wykryte pozycje na
 * bieżąco z historii wydatków (silnik w @vireo/shared ma pełne testy
 * progów). Tu: co API podaje silnikowi, potwierdzanie („To subskrypcja”
 * → stała płatność), odrzucanie i izolacja między użytkownikami.
 */
describe("Subskrypcje (e2e)", () => {
  const clock = new TestClock();
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;
  let subs: { id: string };

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });
  const get = (path: string, session = me) => http().get(path).set(as(session));
  const post = (path: string, body: object, session = me) =>
    http().post(path).set(as(session)).send(body);

  const overview = async (session = me) =>
    (await get("/subscriptions", session).expect(200)).body as SubscriptionsOverviewOutput;

  const KEY = () => `n|${subs.id}|spotify`;

  async function addExpense(date: string, amount: number, note: string | null, session = me) {
    const res = await post(
      "/transactions",
      { date, amount, note, categoryId: subs.id },
      session,
    ).expect(201);
    return idOf(res);
  }

  /** Spotify 10. dnia sierpnia, września i października, 23 zł. */
  async function addSpotify(session = me) {
    for (const date of ["2026-08-10", "2026-09-10", "2026-10-10"]) {
      await addExpense(date, 2_300, "Spotify", session);
    }
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
    clock.set("2026-10-20T10:00:00Z");
    await resetDb(db);
    me = await registerUser(app);
    subs = await db.category.create({
      data: { userId: null, name: "Subskrypcje", icon: "repeat", color: "#4d7c0f" },
    });
  });

  it("bez historii: pusto i zerowe sumy", async () => {
    expect(await overview()).toEqual({
      confirmed: [],
      detected: [],
      totals: {
        confirmed: { count: 0, monthly: 0, yearly: 0 },
        detected: { count: 0, monthly: 0, yearly: 0 },
      },
    });
  });

  it("trzy płatności co miesiąc → wykryta subskrypcja, liczona osobno od potwierdzonych", async () => {
    await addSpotify();

    const result = await overview();

    expect(result.detected).toEqual([
      {
        key: KEY(),
        name: "Spotify",
        categoryId: subs.id,
        frequency: "MONTHLY",
        amount: 2_300,
        monthly: 2_300,
        yearly: 27_600,
        paymentsCount: 3,
        lastDate: "2026-10-10",
        nextDate: "2026-11-10",
        priceChange: null,
      },
    ]);
    expect(result.totals).toEqual({
      confirmed: { count: 0, monthly: 0, yearly: 0 },
      detected: { count: 1, monthly: 2_300, yearly: 27_600 },
    });
  });

  it("wydatek w koszu się nie liczy: bez wrześniowej płatności seria jest za krótka", async () => {
    const ids: string[] = [];
    for (const date of ["2026-08-10", "2026-09-10", "2026-10-10"]) {
      ids.push(await addExpense(date, 2_300, "Spotify"));
    }

    await http()
      .delete(`/transactions/${String(ids[1])}`)
      .set(as(me))
      .expect(204);

    expect((await overview()).detected).toEqual([]);
  });

  it("„dziś” w strefie użytkownika: 21.10 o 0:30 w Warszawie to już 21.10", async () => {
    // Ostatnia płatność 5.09; 45 dni mija 20.10 — 21.10 seria jest już za stara.
    for (const date of ["2026-07-05", "2026-08-05", "2026-09-05"]) {
      await addExpense(date, 2_300, "Spotify");
    }
    clock.set("2026-10-20T21:30:00Z"); // 20.10, 23:30 w Warszawie
    expect((await overview()).detected).toHaveLength(1);

    clock.set("2026-10-20T22:30:00Z"); // 21.10, 0:30 w Warszawie
    expect((await overview()).detected).toEqual([]);
  });

  describe("„To subskrypcja”", () => {
    it("tworzy stałą płatność od następnego terminu i przenosi pozycję do potwierdzonych", async () => {
      await addSpotify();

      const res = await post("/subscriptions/confirm", { key: KEY(), name: "Spotify" }).expect(201);

      expect(res.body).toEqual({
        id: expect.any(String) as unknown,
        kind: "EXPENSE",
        name: "Spotify",
        frequency: "MONTHLY",
        interval: 1,
        startDate: "2026-11-10",
        dayOfMonth: 10,
        dayOfWeek: null,
        expectedAmount: 2_300,
        categoryId: subs.id,
        isActive: true,
        isSubscription: true,
      });
      const result = await overview();
      expect(result.detected).toEqual([]);
      expect(result.confirmed).toEqual([
        {
          ruleId: (res.body as RecurringRule).id,
          name: "Spotify",
          categoryId: subs.id,
          frequency: "MONTHLY",
          interval: 1,
          amount: 2_300,
          monthly: 2_300,
          yearly: 27_600,
          priceChange: null,
        },
      ]);
      expect(result.totals.confirmed).toEqual({ count: 1, monthly: 2_300, yearly: 27_600 });
    });

    it("zapłacony już cykl nie odlicza się drugi raz: budżet tego okresu bez zmian", async () => {
      // Okres 1–31.10; Spotify za październik już zapłacone 10.10.
      await addSpotify();
      const before = (await get("/budget/current").expect(200)).body as {
        availableBalance: number;
      };

      await post("/subscriptions/confirm", { key: KEY(), name: "Spotify" }).expect(201);

      const after = (await get("/budget/current").expect(200)).body as {
        availableBalance: number;
      };
      expect(after.availableBalance).toBe(before.availableBalance);
    });

    it("z Idempotency-Key ponowienie zwraca tę samą regułę zamiast drugiej", async () => {
      await addSpotify();
      const key = "0199a1b2-0000-7000-8000-0000000000aa";
      const send = () =>
        http()
          .post("/subscriptions/confirm")
          .set(as(me))
          .set("Idempotency-Key", key)
          .send({ key: KEY(), name: "Spotify" })
          .expect(201);

      const first = await send();
      const second = await send();

      expect(second.body).toEqual(first.body);
      expect(await db.recurringRule.count({ where: { userId: me.user.id } })).toBe(1);
    });

    it("wydatki bez notatki: nazwa z body", async () => {
      for (const date of ["2026-08-12", "2026-09-12", "2026-10-12"]) {
        await addExpense(date, 3_999, null);
      }
      const [item] = (await overview()).detected;
      expect(item).toMatchObject({ key: `a|${subs.id}|3999`, name: null });

      const res = await post("/subscriptions/confirm", {
        key: `a|${subs.id}|3999`,
        name: "Subskrypcje",
      }).expect(201);

      expect(res.body).toMatchObject({ name: "Subskrypcje", expectedAmount: 3_999 });
      expect((await overview()).detected).toEqual([]);
    });

    it("klucz, którego nie ma wśród wykrytych → 404", async () => {
      await post("/subscriptions/confirm", { key: KEY(), name: "Spotify" }).expect(404);
    });

    it.each([
      ["bez nazwy", { name: undefined }],
      ["pusta nazwa", { name: "  " }],
      ["bez klucza", { key: undefined }],
    ])("%s → 400", async (_case, change) => {
      await post("/subscriptions/confirm", { key: KEY(), name: "Spotify", ...change }).expect(400);
    });
  });

  describe("„To nie subskrypcja”", () => {
    it("odrzucona pozycja znika; ponowne odrzucenie nic nie psuje; „Cofnij” ją przywraca", async () => {
      await addSpotify();

      await post("/subscriptions/dismissals", { key: KEY() }).expect(204);
      await post("/subscriptions/dismissals", { key: KEY() }).expect(204);
      expect((await overview()).detected).toEqual([]);
      expect(await db.subscriptionDismissal.count()).toBe(1);

      await http()
        .delete(`/subscriptions/dismissals?key=${encodeURIComponent(KEY())}`)
        .set(as(me))
        .expect(204);
      expect((await overview()).detected).toHaveLength(1);
    });

    it("„Cofnij” klucza, którego nie odrzucono → 204", async () => {
      await http().delete("/subscriptions/dismissals?key=n%7C%7Cnic").set(as(me)).expect(204);
    });

    it("pusty klucz → 400", async () => {
      await post("/subscriptions/dismissals", { key: "" }).expect(400);
      await http().delete("/subscriptions/dismissals").set(as(me)).expect(400);
    });
  });

  describe("potwierdzone subskrypcje", () => {
    const netflix = (categoryId: string) => ({
      kind: "EXPENSE",
      name: "Netflix",
      frequency: "MONTHLY",
      startDate: "2026-08-10",
      dayOfMonth: 10,
      expectedAmount: 4_900,
      categoryId,
      isSubscription: true,
    });

    it("stała płatność oznaczona jako subskrypcja, z podwyżką z potwierdzonych płatności", async () => {
      const rule = idOf(await post("/recurring-rules", netflix(subs.id)).expect(201));
      // Płatności reguły powstają z potwierdzeń („Inna kwota” przy podwyżce).
      for (const [date, amount] of [
        ["2026-08-10", 4_300],
        ["2026-09-10", 4_300],
        ["2026-10-10", 4_900],
      ] as const) {
        await db.transaction.create({
          data: {
            userId: me.user.id,
            recurringRuleId: rule,
            categoryId: subs.id,
            amount,
            date: new Date(`${date}T00:00:00Z`),
            occurrenceDate: new Date(`${date}T00:00:00Z`),
          },
        });
      }

      expect((await overview()).confirmed).toEqual([
        expect.objectContaining({
          ruleId: rule,
          amount: 4_900,
          priceChange: { from: 4_300, to: 4_900, since: "2026-10-10", yearlyDelta: 7_200 },
        }),
      ]);
    });

    it("wyłączona albo zwykła stała płatność nie jest subskrypcją", async () => {
      const rule = idOf(await post("/recurring-rules", netflix(subs.id)).expect(201));
      await post("/recurring-rules", {
        ...netflix(subs.id),
        name: "Czynsz",
        isSubscription: false,
      }).expect(201);
      await http().patch(`/recurring-rules/${rule}`).set(as(me)).send({ isActive: false });

      expect((await overview()).confirmed).toEqual([]);
    });

    it("PATCH oznacza istniejącą stałą płatność jako subskrypcję", async () => {
      const rule = idOf(
        await post("/recurring-rules", { ...netflix(subs.id), isSubscription: false }).expect(201),
      );

      const res = await http()
        .patch(`/recurring-rules/${rule}`)
        .set(as(me))
        .send({ isSubscription: true })
        .expect(200);

      expect((res.body as RecurringRule).isSubscription).toBe(true);
      expect((await overview()).confirmed).toHaveLength(1);
    });

    it("reguła dochodu nie może być subskrypcją → 400", async () => {
      await post("/recurring-rules", {
        kind: "INCOME",
        frequency: "MONTHLY",
        startDate: "2026-08-10",
        dayOfMonth: 10,
        isSubscription: true,
      }).expect(400);
    });

    it("stała płatność o tej samej nazwie blokuje podpowiedź (nie dublujemy)", async () => {
      await addSpotify();
      await post("/recurring-rules", {
        ...netflix(subs.id),
        name: "Spotify",
        isSubscription: false,
      }).expect(201);

      expect((await overview()).detected).toEqual([]);
    });
  });

  describe("izolacja", () => {
    it("wydatki, odrzucenia i potwierdzenia Boba nie dotyczą Alice", async () => {
      const bob = await registerUser(app);
      await addSpotify(bob);
      await post("/subscriptions/dismissals", { key: KEY() }, bob).expect(204);

      expect((await overview()).detected).toEqual([]);
      await post("/subscriptions/confirm", { key: KEY(), name: "Spotify" }).expect(404);

      await addSpotify();
      expect((await overview()).detected).toHaveLength(1);
      expect((await overview(bob)).detected).toEqual([]);
    });
  });
});
