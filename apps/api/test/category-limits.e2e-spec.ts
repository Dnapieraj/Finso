import type { CategoryLimitsOverview } from "@vireo/shared";
import request from "supertest";

import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp, TestSession, ValidationErrorBody } from "./helpers.js";
import { createTestApp, createTestDb, idOf, registerUser, resetDb, TestClock } from "./helpers.js";

/**
 * Limity na kategorie: ile najwyżej wydać w kategorii w okresie budżetowym.
 * Logikę liczy @vireo/shared (categoryLimitStatuses, leanMonth); tu klejenie —
 * właściwe wydatki (własne, nieusunięte), okres użytkownika, izolacja.
 */
const clock = new TestClock();

describe("Limity na kategorie (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;
  let food: string;
  let fun: string;

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });
  const put = (path: string, body: object, session = me) =>
    http().put(path).set(as(session)).send(body);
  const del = (path: string, session = me) => http().delete(path).set(as(session));
  const post = (path: string, body: object, session = me) =>
    http().post(path).set(as(session)).send(body).expect(201);
  const overview = async (session = me) =>
    (await http().get("/category-limits").set(as(session)).expect(200))
      .body as CategoryLimitsOverview;

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
    // Środa 21.10.2026, 12:00 w Warszawie; okres = październik (wypłata 1.).
    clock.set("2026-10-21T10:00:00Z");
    me = await registerUser(app);
    const category = (name: string) =>
      db.category.create({ data: { userId: null, name, icon: "tag", color: "#4d7c0f" } });
    food = (await category("Jedzenie")).id;
    fun = (await category("Rozrywka")).id;
  });

  it("bez limitów: pusto, bez chudego okresu", async () => {
    expect(await overview()).toEqual({ limits: [], leanMonth: null });
  });

  it("ustawia limit i liczy wydatki kategorii w bieżącym okresie", async () => {
    await put(`/category-limits/${food}`, { amount: 80_000 }).expect(204);
    await post("/transactions", { amount: 30_000, date: "2026-10-03", categoryId: food });
    await post("/transactions", { amount: 20_000, date: "2026-10-21", categoryId: food });
    // Wrzesień i inna kategoria się nie liczą.
    await post("/transactions", { amount: 99_000, date: "2026-09-30", categoryId: food });
    await post("/transactions", { amount: 5_000, date: "2026-10-10", categoryId: fun });

    expect((await overview()).limits).toEqual([
      {
        categoryId: food,
        limit: 80_000,
        spent: 50_000,
        left: 30_000,
        perDayLeft: 2_727,
        state: "ok",
      },
    ]);
  });

  it("wydatek w koszu się nie liczy", async () => {
    await put(`/category-limits/${food}`, { amount: 80_000 }).expect(204);
    const coffee = idOf(
      await post("/transactions", { amount: 30_000, date: "2026-10-03", categoryId: food }),
    );
    await del(`/transactions/${coffee}`).expect(204);

    expect((await overview()).limits[0]).toMatchObject({ spent: 0 });
  });

  it("drugi PUT zmienia kwotę — nadal jeden limit na kategorię", async () => {
    await put(`/category-limits/${food}`, { amount: 80_000 }).expect(204);
    await put(`/category-limits/${food}`, { amount: 60_000 }).expect(204);

    expect((await overview()).limits.map((limit) => limit.limit)).toEqual([60_000]);
  });

  it("lista w kolejności dodania", async () => {
    await put(`/category-limits/${fun}`, { amount: 20_000 }).expect(204);
    await put(`/category-limits/${food}`, { amount: 80_000 }).expect(204);

    expect((await overview()).limits.map((limit) => limit.categoryId)).toEqual([fun, food]);
  });

  it("usuwa limit naprawdę; wydatki zostają", async () => {
    await put(`/category-limits/${food}`, { amount: 80_000 }).expect(204);
    await post("/transactions", { amount: 30_000, date: "2026-10-03", categoryId: food });

    await del(`/category-limits/${food}`).expect(204);

    expect((await overview()).limits).toEqual([]);
    expect(await db.categoryLimit.count()).toBe(0);
    expect(await db.transaction.count()).toBe(1);
  });

  it("usunięcie limitu, którego nie ma → 404", async () => {
    await del(`/category-limits/${food}`).expect(404);
  });

  it.each([
    ["kwota 0", { amount: 0 }],
    ["kwota ułamkowa", { amount: 12.5 }],
    ["bez kwoty", {}],
  ])("odrzuca: %s → 400", async (_case, body) => {
    await put(`/category-limits/${food}`, body).expect(400);
  });

  it("nieznana kategoria → 400 unknown_reference", async () => {
    const res = await put("/category-limits/01923b6e-0000-7000-8000-000000000999", {
      amount: 1_000,
    }).expect(400);

    expect((res.body as ValidationErrorBody).errors[0]).toMatchObject({
      code: "unknown_reference",
      path: ["categoryId"],
    });
  });

  it("usunięcie kategorii zabiera jej limit", async () => {
    const own = idOf(await post("/categories", { name: "Hobby", icon: "tag", color: "#4d7c0f" }));
    await put(`/category-limits/${own}`, { amount: 10_000 }).expect(204);

    await db.category.delete({ where: { id: own } });

    expect((await overview()).limits).toEqual([]);
  });

  describe("izolacja", () => {
    it("użytkownik B nie widzi, nie zmienia i nie usuwa limitów A", async () => {
      await put(`/category-limits/${food}`, { amount: 80_000 }).expect(204);
      const bob = await registerUser(app);

      expect(await overview(bob)).toEqual({ limits: [], leanMonth: null });
      await del(`/category-limits/${food}`, bob).expect(404);
      await put(`/category-limits/${food}`, { amount: 1_000 }, bob).expect(204);

      expect((await overview()).limits[0]).toMatchObject({ limit: 80_000 });
    });

    it("limit liczy tylko własne wydatki", async () => {
      const bob = await registerUser(app);
      await put(`/category-limits/${food}`, { amount: 80_000 }).expect(204);
      await post("/transactions", { amount: 70_000, date: "2026-10-03", categoryId: food }, bob);

      expect((await overview()).limits[0]).toMatchObject({ spent: 0 });
    });

    it("limit na cudzą kategorię własną → 400", async () => {
      const bob = await registerUser(app);
      const bobs = idOf(
        await post("/categories", { name: "Bob", icon: "tag", color: "#4d7c0f" }, bob),
      );

      await put(`/category-limits/${bobs}`, { amount: 1_000 }).expect(400);
    });
  });

  describe("chudy miesiąc", () => {
    /** Zlecenia od lipca: lipiec 5000, sierpień 3000, wrzesień 6000 → prognoza 3000, zwykle 5000. */
    async function seedFreelancer() {
      const source = idOf(await post("/income/sources", { name: "Zlecenia", kind: "IRREGULAR" }));
      await db.incomeSource.update({
        where: { id: source },
        data: { createdAt: new Date("2026-07-01T08:00:00Z") },
      });
      await db.user.update({
        where: { id: me.user.id },
        data: { onboardingCompletedAt: new Date("2026-07-01T08:00:00Z") },
      });
      for (const [date, amount] of [
        ["2026-07-12", 500_000],
        ["2026-08-20", 300_000],
        ["2026-09-05", 600_000],
      ] as const) {
        await post("/income/entries", { incomeSourceId: source, amount, date });
      }
      // Jedzenie 900 zł co miesiąc; czynsz jako płatność zobowiązania się nie liczy.
      for (const date of ["2026-07-15", "2026-08-15", "2026-09-15"]) {
        await post("/transactions", { amount: 90_000, date, categoryId: food });
      }
      return source;
    }

    it("liczony dochód poniżej zwykłego: o ile i co przyciąć", async () => {
      await seedFreelancer();

      expect((await overview()).leanMonth).toEqual({
        counted: 300_000,
        typical: 500_000,
        shortfall: 200_000,
        suggestions: [{ categoryId: food, usual: 90_000, suggested: 63_000 }],
      });
    });

    it("wpłynęło już tyle, co zwykle — nie jest chudy", async () => {
      const source = await seedFreelancer();
      await post("/income/entries", {
        incomeSourceId: source,
        amount: 500_000,
        date: "2026-10-02",
      });

      expect((await overview()).leanMonth).toBeNull();
    });

    it("dochód stały — nigdy", async () => {
      await post("/transactions", { amount: 90_000, date: "2026-09-15", categoryId: food });

      expect((await overview()).leanMonth).toBeNull();
    });
  });
});
