import type { BudgetSummary, RecurringRule } from "@vireo/shared";
import request from "supertest";

import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp, TestSession } from "./helpers.js";
import { createTestApp, createTestDb, registerUser, resetDb, TestClock } from "./helpers.js";

/**
 * Zmiana dnia wypłaty w trakcie okresu: `PATCH /users/me` przesuwa start
 * reguł, które obejmowały cały stary okres (logika i przypadki brzegowe:
 * rebaseRuleStarts w @vireo/shared). Tu — że API to robi, w jednej
 * transakcji, i że budżet żadnej płatności nie gubi ani nie dubluje.
 */

const clock = new TestClock();

describe("Zmiana dnia wypłaty (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });
  const get = async <T>(path: string) => (await http().get(path).set(as(me)).expect(200)).body as T;
  const setPayday = (periodStartDay: number) =>
    http().patch("/users/me").set(as(me)).send({ periodStartDay }).expect(200);
  const budget = () => get<BudgetSummary>("/budget/current");
  const startOf = async (name: string | null) =>
    (await get<RecurringRule[]>("/recurring-rules")).find((rule) => rule.name === name)?.startDate;

  beforeAll(async () => {
    app = await createTestApp((builder) => builder.overrideProvider(CLOCK).useValue(clock));
    db = createTestDb();
  });

  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  /** Onboarding 23.09: wypłata 10. (8000 zł), czynsz 5. (2500 zł) — okres 10.09–9.10. */
  beforeEach(async () => {
    await resetDb(db);
    clock.set("2026-09-23T10:00:00Z");
    me = await registerUser(app);
    const bills = await db.category.create({
      data: { userId: null, name: "Rachunki", icon: "bills", color: "#b45309" },
    });
    await http()
      .post("/users/me/onboarding")
      .set(as(me))
      .send({
        periodStartDay: 10,
        timezone: "Europe/Warsaw",
        income: { kind: "REGULAR", name: "Wypłata", amount: 800_000, dayOfMonth: 10 },
        commitments: [{ name: "Czynsz", amount: 250_000, dayOfMonth: 5, categoryId: bills.id }],
      })
      .expect(200);
  });

  it("przed zmianą: wypłata 10.09 i czynsz 5.10 w okresie 10.09–9.10", async () => {
    expect((await budget()).breakdown).toMatchObject({
      periodIncome: 800_000,
      fixedCommitments: 250_000,
    });
  });

  it("wcześniejszy początek (10 → 1): czynsz z 5.09 się liczy — nie ginie", async () => {
    await setPayday(1);

    expect(await budget()).toMatchObject({
      period: { start: "2026-09-01", end: "2026-09-30" },
      breakdown: { periodIncome: 800_000, fixedCommitments: 250_000 },
      fixedCommitments: [{ label: "Czynsz", amount: 250_000 }],
    });
    expect(await startOf("Czynsz")).toBe("2026-09-01");
    expect(await startOf(null)).toBe("2026-09-01");
  });

  it("i z powrotem (1 → 10): ten sam budżet co na początku — nic się nie dubluje", async () => {
    await setPayday(1);
    await setPayday(10);

    expect(await budget()).toMatchObject({
      period: { start: "2026-09-10", end: "2026-10-09" },
      breakdown: { periodIncome: 800_000, fixedCommitments: 250_000 },
    });
  });

  it("zobowiązanie dodane „od dziś” zostaje: jego wcześniejsza płatność mogła być zapisana ręcznie", async () => {
    await http()
      .post("/recurring-rules")
      .set(as(me))
      .send({
        kind: "EXPENSE",
        name: "Siłownia",
        frequency: "MONTHLY",
        startDate: "2026-09-23",
        dayOfMonth: 20,
        expectedAmount: 12_000,
      })
      .expect(201);
    // Siłownia z 20.09, zapłacona i zapisana jako wydatek.
    await http()
      .post("/transactions")
      .set(as(me))
      .send({ amount: 12_000, date: "2026-09-20" })
      .expect(201);

    await setPayday(1);

    expect(await startOf("Siłownia")).toBe("2026-09-23");
    // 20.09 raz — jako wydatek, nie drugi raz jako zobowiązanie.
    expect((await budget()).breakdown).toMatchObject({
      fixedCommitments: 250_000,
      alreadySpent: 12_000,
    });
  });

  it("późniejszy początek (10 → 20): starty reguł bez zmian", async () => {
    await setPayday(20);

    expect(await startOf("Czynsz")).toBe("2026-09-10");
    expect(await startOf(null)).toBe("2026-09-10");
  });

  it("zmiana samej strefy czasowej nie rusza reguł", async () => {
    await http().patch("/users/me").set(as(me)).send({ timezone: "Europe/Berlin" }).expect(200);

    expect(await startOf("Czynsz")).toBe("2026-09-10");
  });

  it("zły dzień (29): 400 i ani dzień, ani reguły się nie zmieniają", async () => {
    await http().patch("/users/me").set(as(me)).send({ periodStartDay: 29 }).expect(400);

    expect(await startOf("Czynsz")).toBe("2026-09-10");
    expect((await get<{ periodStartDay: number }>("/users/me")).periodStartDay).toBe(10);
  });

  it("reguły innego użytkownika zostają nietknięte", async () => {
    const mine = me;
    me = await registerUser(app);
    await http()
      .post("/recurring-rules")
      .set(as(me))
      .send({
        kind: "EXPENSE",
        name: "Czynsz B",
        frequency: "MONTHLY",
        startDate: "2026-09-10",
        dayOfMonth: 5,
        expectedAmount: 100_000,
      })
      .expect(201);
    const other = me;
    me = mine;

    await setPayday(1);

    me = other;
    expect(await startOf("Czynsz B")).toBe("2026-09-10");
  });
});
