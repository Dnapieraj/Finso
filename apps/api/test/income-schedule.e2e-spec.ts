import type {
  BudgetSummary,
  IncomeSource,
  RecurringRule,
  Transaction,
  TransactionPage,
} from "@vireo/shared";
import request from "supertest";

import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp, TestSession, ValidationErrorBody } from "./helpers.js";
import {
  anyString,
  createTestApp,
  createTestDb,
  idOf,
  registerUser,
  resetDb,
  TestClock,
} from "./helpers.js";

/**
 * Dochód stały to źródło (kwota, nazwa) i reguła INCOME (kiedy wpływa).
 * Appka edytuje je jako jedno — `schedule` w body źródła zapisuje oba
 * w jednej transakcji bazy, bez samotnych reguł po zerwanym połączeniu.
 */

const clock = new TestClock();

const monthly = { frequency: "MONTHLY", startDate: "2026-09-01", dayOfMonth: 10 } as const;
const biweekly = {
  frequency: "WEEKLY",
  interval: 2,
  startDate: "2026-09-04",
  dayOfWeek: 5,
} as const;

describe("Źródło dochodu z harmonogramem (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });
  const get = async <T>(path: string, session: TestSession = me) =>
    (await http().get(path).set(as(session)).expect(200)).body as T;
  const post = (path: string, body: object, session: TestSession = me) =>
    http().post(path).set(as(session)).send(body);
  const patch = (path: string, body: object, session: TestSession = me) =>
    http().patch(path).set(as(session)).send(body);

  const createSalary = async (schedule: object | null = monthly) =>
    (
      await post("/income/sources", {
        name: "Wypłata",
        kind: "REGULAR",
        expectedAmount: 800_000,
        schedule,
      }).expect(201)
    ).body as IncomeSource;

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
    // Środa 23.09.2026 w Warszawie; okres wrzesień (periodStartDay 1).
    clock.set("2026-09-23T10:00:00Z");
    me = await registerUser(app);
  });

  describe("POST /income/sources z `schedule`", () => {
    it("tworzy źródło i podpiętą regułę INCOME; odpowiedź niesie harmonogram", async () => {
      const source = await createSalary();

      expect(source).toEqual({
        id: anyString,
        name: "Wypłata",
        kind: "REGULAR",
        expectedAmount: 800_000,
        recurringRuleId: anyString,
        isActive: true,
        schedule: { ...monthly, interval: 1, dayOfWeek: null },
      });
      expect(await get<RecurringRule[]>("/recurring-rules")).toEqual([
        expect.objectContaining({
          id: source.recurringRuleId,
          kind: "INCOME",
          name: null,
          ...monthly,
          interval: 1,
          dayOfWeek: null,
        }),
      ]);
    });

    it("co 2 tygodnie: budżet liczy każde wystąpienie w okresie", async () => {
      await createSalary(biweekly);

      // Piątki 4.09, 18.09 we wrześniu: 2 × 8000 zł.
      expect((await get<BudgetSummary>("/budget/current")).breakdown.periodIncome).toBe(1_600_000);
    });

    it("GET /income/sources: harmonogram przy źródle, null bez niego", async () => {
      await createSalary();
      await post("/income/sources", { name: "Zlecenia", kind: "IRREGULAR" }).expect(201);

      const sources = await get<IncomeSource[]>("/income/sources");
      expect(sources.map((source) => [source.name, source.schedule?.dayOfMonth ?? null])).toEqual([
        ["Wypłata", 10],
        ["Zlecenia", null],
      ]);
    });

    it("dochód nieregularny z harmonogramem: 400 i nic nie powstaje", async () => {
      const res = await post("/income/sources", {
        name: "Zlecenia",
        kind: "IRREGULAR",
        schedule: monthly,
      }).expect(400);

      expect((res.body as ValidationErrorBody).errors).toEqual([
        expect.objectContaining({ path: ["schedule"], message: "not_allowed_for_irregular" }),
      ]);
      expect(await get<RecurringRule[]>("/recurring-rules")).toEqual([]);
    });
  });

  describe("PATCH /income/sources/:id", () => {
    it("zmiana nazwy i kwoty nie rusza harmonogramu", async () => {
      const source = await createSalary();

      const res = await patch(`/income/sources/${source.id}`, {
        name: "Pensja",
        expectedAmount: 850_000,
      }).expect(200);

      expect(res.body).toMatchObject({
        name: "Pensja",
        expectedAmount: 850_000,
        recurringRuleId: source.recurringRuleId,
        schedule: source.schedule,
      });
      expect((await get<BudgetSummary>("/budget/current")).breakdown.periodIncome).toBe(850_000);
    });

    it("nowy harmonogram zmienia tę samą regułę, a budżet liczy według niego", async () => {
      const source = await createSalary();

      const res = await patch(`/income/sources/${source.id}`, { schedule: biweekly }).expect(200);

      expect((res.body as IncomeSource).recurringRuleId).toBe(source.recurringRuleId);
      expect((res.body as IncomeSource).schedule).toEqual({ ...biweekly, dayOfMonth: null });
      expect(await get<RecurringRule[]>("/recurring-rules")).toHaveLength(1);
      expect((await get<BudgetSummary>("/budget/current")).breakdown.periodIncome).toBe(1_600_000);
    });

    it("źródło bez harmonogramu dostaje nową regułę", async () => {
      const source = await createSalary(null);

      const res = await patch(`/income/sources/${source.id}`, { schedule: monthly }).expect(200);

      const [rule] = await get<RecurringRule[]>("/recurring-rules");
      expect((res.body as IncomeSource).recurringRuleId).toBe(rule?.id);
    });

    it("`schedule: null` odpina i usuwa regułę — to był tylko harmonogram", async () => {
      const source = await createSalary();

      const res = await patch(`/income/sources/${source.id}`, { schedule: null }).expect(200);

      expect(res.body).toMatchObject({ recurringRuleId: null, schedule: null });
      expect(await get<RecurringRule[]>("/recurring-rules")).toEqual([]);
    });

    it("zła zmiana (harmonogram dla nieregularnego) nie zmienia niczego", async () => {
      const source = await createSalary();

      await patch(`/income/sources/${source.id}`, {
        kind: "IRREGULAR",
        expectedAmount: null,
      }).expect(400);

      expect(await get<IncomeSource>(`/income/sources/${source.id}`)).toEqual(source);
    });

    it("cudzego źródła nie da się zmienić ani podpiąć mu harmonogramu (404)", async () => {
      const other = await registerUser(app);
      const source = await createSalary(null);

      await patch(`/income/sources/${source.id}`, { schedule: monthly }, other).expect(404);

      expect(await get<RecurringRule[]>("/recurring-rules", other)).toEqual([]);
      expect(await get<RecurringRule[]>("/recurring-rules")).toEqual([]);
    });
  });

  it("archiwizacja źródła z wpływami: DELETE to 409, isActive: false wyłącza je z budżetu", async () => {
    const source = await createSalary();
    await post("/income/entries", {
      incomeSourceId: source.id,
      amount: 800_000,
      date: "2026-09-10",
    }).expect(201);

    await http().delete(`/income/sources/${source.id}`).set(as(me)).expect(409);
    await patch(`/income/sources/${source.id}`, { isActive: false }).expect(200);

    // Potwierdzony wpływ zostaje faktem; kolejnych wystąpień już nie oczekujemy.
    expect((await get<BudgetSummary>("/budget/current")).breakdown.periodIncome).toBe(800_000);
  });

  describe("DELETE /recurring-rules/:id", () => {
    it("usuwa regułę, ale wydatki, które z niej powstały, zostają (bez powiązania)", async () => {
      const rule = await post("/recurring-rules", {
        kind: "EXPENSE",
        name: "Czynsz",
        frequency: "MONTHLY",
        startDate: "2026-09-23",
        dayOfMonth: 5,
        expectedAmount: 250_000,
      }).expect(201);
      const paid = (
        await post("/transactions", {
          amount: 250_000,
          date: "2026-09-05",
          recurringRuleId: idOf(rule),
        }).expect(201)
      ).body as Transaction;

      await http()
        .delete(`/recurring-rules/${idOf(rule)}`)
        .set(as(me))
        .expect(204);

      expect((await get<TransactionPage>("/transactions")).items).toEqual([
        { ...paid, recurringRuleId: null },
      ]);
      expect(await get<BudgetSummary>("/budget/current")).toMatchObject({
        breakdown: { alreadySpent: 250_000, fixedCommitments: 0 },
      });
    });
  });
});
