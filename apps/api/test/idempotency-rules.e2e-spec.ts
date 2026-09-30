import request from "supertest";

import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp, TestSession } from "./helpers.js";
import { createTestApp, createTestDb, registerUser, resetDb, TestClock } from "./helpers.js";

/**
 * Ten sam mechanizm co przy POST /transactions (idempotency.e2e-spec.ts):
 * tu sprawdzamy, że działa też dla reguł cyklicznych, źródeł dochodu i celów,
 * a klucz obowiązuje w obrębie jednego endpointu.
 */

const clock = new TestClock();
const KEY = "0199a1b2-0000-7000-8000-000000000001";

const rent = {
  kind: "EXPENSE",
  name: "Czynsz",
  frequency: "MONTHLY",
  startDate: "2026-09-28",
  dayOfMonth: 5,
  expectedAmount: 250_000,
};
const salary = {
  name: "Wypłata",
  kind: "REGULAR",
  expectedAmount: 800_000,
  schedule: { frequency: "MONTHLY", startDate: "2026-09-01", dayOfMonth: 10 },
};

const trip = { name: "Wakacje", targetAmount: 500_000, targetDate: "2027-06-30" };

describe.each([
  { path: "/recurring-rules", body: rent, changed: { ...rent, expectedAmount: 260_000 } },
  { path: "/income/sources", body: salary, changed: { ...salary, name: "Pensja" } },
  { path: "/goals", body: trip, changed: { ...trip, targetAmount: 600_000 } },
])("Idempotency-Key dla POST $path (e2e)", ({ path, body, changed }) => {
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;

  const http = () => request(app.getHttpServer());
  const create = (payload: object, key?: string) => {
    const req = http().post(path).set("Authorization", `Bearer ${me.accessToken}`);
    return (key ? req.set("Idempotency-Key", key) : req).send(payload);
  };
  /** Wiersze użytkownika: źródło z harmonogramem to źródło + reguła INCOME. */
  const counts = async () => ({
    rules: await db.recurringRule.count({ where: { userId: me.user.id } }),
    sources: await db.incomeSource.count({ where: { userId: me.user.id } }),
    goals: await db.goal.count({ where: { userId: me.user.id } }),
  });
  const once = {
    "/recurring-rules": { rules: 1, sources: 0, goals: 0 },
    "/income/sources": { rules: 1, sources: 1, goals: 0 },
    "/goals": { rules: 0, sources: 0, goals: 1 },
  }[path] ?? { rules: 0, sources: 0, goals: 0 };

  beforeAll(async () => {
    app = await createTestApp((builder) => builder.overrideProvider(CLOCK).useValue(clock));
    db = createTestDb();
  });

  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  beforeEach(async () => {
    clock.set("2026-09-28T12:00:00Z");
    await resetDb(db);
    me = await registerUser(app);
  });

  it("bez klucza działa jak dotąd: każde żądanie tworzy nowy wiersz", async () => {
    await create(body).expect(201);
    await create(body).expect(201);

    expect(await counts()).toEqual({
      rules: once.rules * 2,
      sources: once.sources * 2,
      goals: once.goals * 2,
    });
  });

  it("ten sam klucz dwa razy: jeden zapis i ta sama odpowiedź", async () => {
    const first = await create(body, KEY).expect(201);
    const retry = await create(body, KEY).expect(201);

    expect(retry.body).toEqual(first.body);
    expect(retry.headers["idempotent-replayed"]).toBe("true");
    expect(await counts()).toEqual(once);
  });

  it("jednoczesne żądania z tym samym kluczem: dokładnie jeden zapis", async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => create(body, KEY)));

    expect(responses.map((res) => res.status)).toEqual([201, 201, 201, 201, 201]);
    expect(new Set(responses.map((res) => JSON.stringify(res.body))).size).toBe(1);
    expect(await counts()).toEqual(once);
  });

  it("ten sam klucz z inną treścią: 422 i nic nowego", async () => {
    await create(body, KEY).expect(201);

    await create(changed, KEY).expect(422);

    expect(await counts()).toEqual(once);
  });

  it("klucz, który nie jest UUID: 400", async () => {
    await create(body, "not-a-uuid").expect(400);

    expect(await counts()).toEqual({ rules: 0, sources: 0, goals: 0 });
  });

  it("klucz dotyczy jednego endpointu: ten sam UUID przy wydatku to osobny zapis", async () => {
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${me.accessToken}`)
      .set("Idempotency-Key", KEY)
      .send({ amount: 4_590, date: "2026-09-28" })
      .expect(201);

    await create(body, KEY).expect(201);

    expect(await counts()).toEqual(once);
  });

  it("klucz innego użytkownika nie odtwarza jego odpowiedzi", async () => {
    await create(body, KEY).expect(201);
    const mine = me;
    me = await registerUser(app);

    const res = await create(body, KEY).expect(201);

    expect(res.headers["idempotent-replayed"]).toBeUndefined();
    expect(await counts()).toEqual(once);
    me = mine;
  });

  it("zły body z kluczem: 400, a klucz można użyć ponownie z poprawnym", async () => {
    await create({ ...body, name: "" }, KEY).expect(400);

    await create(body, KEY).expect(201);

    expect(await counts()).toEqual(once);
  });
});
