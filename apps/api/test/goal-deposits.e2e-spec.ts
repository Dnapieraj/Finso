import type { BudgetSummary, ExportData, Goal, GoalDeposit } from "@vireo/shared";
import request from "supertest";

import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp, TestSession } from "./helpers.js";
import {
  anyString,
  createTestApp,
  createTestDb,
  registerUser,
  resetDb,
  TEST_PASSWORD,
  TestClock,
} from "./helpers.js";

/**
 * Wpłaty na cel: osobne zapisy z datą, które da się cofnąć. Odłożone na
 * cel (`currentAmount`) = kwota wpisana ręcznie + wpłaty. Wpłata w ramach
 * raty z tego okresu nie zmienia budżetu; wpłata ponad ratę go zmniejsza.
 */

const clock = new TestClock();

describe("Wpłaty na cel (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });
  const get = async <T>(path: string, session: TestSession = me) =>
    (await http().get(path).set(as(session)).expect(200)).body as T;
  const post = (path: string, body: object, session: TestSession = me, key?: string) => {
    const req = http().post(path).set(as(session));
    return (key ? req.set("Idempotency-Key", key) : req).send(body);
  };

  // Wrzesień–listopad = 3 okresy; 90 000 / 3 = 30 000 na okres.
  const createGoal = async (currentAmount = 0) =>
    (
      await post("/goals", {
        name: "Wakacje",
        targetAmount: 90_000,
        currentAmount,
        targetDate: "2026-11-30",
      }).expect(201)
    ).body as Goal;
  const deposit = (goalId: string, body: object, session: TestSession = me, key?: string) =>
    post(`/goals/${goalId}/deposits`, body, session, key);
  const budget = () => get<BudgetSummary>("/budget/current");
  const goalOf = (id: string) => get<Goal>(`/goals/${id}`);

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

  it("wpłata bez daty idzie na dziś i zwiększa odłożone na cel", async () => {
    const goal = await createGoal(5_000);

    const res = await deposit(goal.id, { amount: 10_000 }).expect(201);

    expect(res.body).toEqual({
      id: anyString,
      goalId: goal.id,
      amount: 10_000,
      date: "2026-09-23",
    });
    expect((await goalOf(goal.id)).currentAmount).toBe(15_000);
    expect(await get<GoalDeposit[]>(`/goals/${goal.id}/deposits`)).toEqual([res.body]);
  });

  it("lista wpłat — najnowsza pierwsza", async () => {
    const goal = await createGoal();
    await deposit(goal.id, { amount: 1_000, date: "2026-09-01" }).expect(201);
    await deposit(goal.id, { amount: 2_000, date: "2026-09-20" }).expect(201);

    const list = await get<GoalDeposit[]>(`/goals/${goal.id}/deposits`);

    expect(list.map((item) => item.date)).toEqual(["2026-09-20", "2026-09-01"]);
  });

  it("wpłata w ramach raty nie zmienia „Możesz wydać”", async () => {
    const goal = await createGoal();
    const before = await budget();

    await deposit(goal.id, { amount: 10_000 }).expect(201);

    const after = await budget();
    expect(after.goalContributions).toEqual([
      { goalId: goal.id, amount: 30_000, deposited: 10_000 },
    ]);
    expect(after.availableBalance).toBe(before.availableBalance);
  });

  it("wpłata ponad ratę zmniejsza budżet o nadwyżkę", async () => {
    const goal = await createGoal();
    const before = await budget();

    await deposit(goal.id, { amount: 40_000 }).expect(201);

    const after = await budget();
    expect(after.goalContributions).toEqual([
      { goalId: goal.id, amount: 40_000, deposited: 40_000 },
    ]);
    expect(after.availableBalance).toBe(before.availableBalance - 10_000);
  });

  it("usunięta wpłata znika z celu i budżetu, a przywrócona wraca", async () => {
    const goal = await createGoal();
    const made = (await deposit(goal.id, { amount: 40_000 }).expect(201)).body as GoalDeposit;

    await http().delete(`/goals/${goal.id}/deposits/${made.id}`).set(as(me)).expect(204);

    expect((await goalOf(goal.id)).currentAmount).toBe(0);
    expect(await get<GoalDeposit[]>(`/goals/${goal.id}/deposits`)).toEqual([]);
    expect((await budget()).goalContributions[0]).toMatchObject({ amount: 30_000, deposited: 0 });

    const restored = await http()
      .post(`/goals/${goal.id}/deposits/${made.id}/restore`)
      .set(as(me))
      .expect(200);

    expect(restored.body).toEqual(made);
    expect((await goalOf(goal.id)).currentAmount).toBe(40_000);
  });

  it("ręczna zmiana „Już odłożone” to korekta: wpłaty zostają, budżet ich nie liczy podwójnie", async () => {
    const goal = await createGoal();
    await deposit(goal.id, { amount: 10_000 }).expect(201);

    const res = await http()
      .patch(`/goals/${goal.id}`)
      .set(as(me))
      .send({ currentAmount: 25_000 })
      .expect(200);

    expect((res.body as Goal).currentAmount).toBe(25_000);
    expect(await get<GoalDeposit[]>(`/goals/${goal.id}/deposits`)).toHaveLength(1);
    // Na początku okresu było 15 000 → zostało 75 000 na 3 okresy.
    expect((await budget()).goalContributions[0]).toMatchObject({
      amount: 25_000,
      deposited: 10_000,
    });
  });

  it("korekta nie może zejść poniżej sumy wpłat (400)", async () => {
    const goal = await createGoal();
    await deposit(goal.id, { amount: 10_000 }).expect(201);

    await http().patch(`/goals/${goal.id}`).set(as(me)).send({ currentAmount: 5_000 }).expect(400);

    expect((await goalOf(goal.id)).currentAmount).toBe(10_000);
  });

  it("zła wpłata: zero, ujemna, z przyszłości, bez kwoty — 400", async () => {
    const goal = await createGoal();

    await deposit(goal.id, { amount: 0 }).expect(400);
    await deposit(goal.id, { amount: -100 }).expect(400);
    await deposit(goal.id, { amount: 1_000, date: "2026-09-24" }).expect(400);
    await deposit(goal.id, {}).expect(400);

    expect(await get<GoalDeposit[]>(`/goals/${goal.id}/deposits`)).toEqual([]);
  });

  it("ten sam Idempotency-Key — jedna wpłata, ile by nie było ponowień", async () => {
    const goal = await createGoal();
    const key = "6f1c1d1e-2b3a-4c5d-8e9f-0a1b2c3d4e5f";

    const first = await deposit(goal.id, { amount: 10_000 }, me, key).expect(201);
    const second = await deposit(goal.id, { amount: 10_000 }, me, key).expect(201);

    expect(second.body).toEqual(first.body);
    expect(await get<GoalDeposit[]>(`/goals/${goal.id}/deposits`)).toHaveLength(1);
  });

  it("cel w koszu nie przyjmuje wpłat (404)", async () => {
    const goal = await createGoal();
    await http().delete(`/goals/${goal.id}`).set(as(me)).expect(204);

    await deposit(goal.id, { amount: 1_000 }).expect(404);
  });

  it("cudzy cel: nie widać, nie da się wpłacić ani usunąć wpłaty (404)", async () => {
    const goal = await createGoal();
    const made = (await deposit(goal.id, { amount: 10_000 }).expect(201)).body as GoalDeposit;
    const other = await registerUser(app);

    await http().get(`/goals/${goal.id}/deposits`).set(as(other)).expect(404);
    await deposit(goal.id, { amount: 1_000 }, other).expect(404);
    await http().delete(`/goals/${goal.id}/deposits/${made.id}`).set(as(other)).expect(404);
    await http().post(`/goals/${goal.id}/deposits/${made.id}/restore`).set(as(other)).expect(404);

    expect((await goalOf(goal.id)).currentAmount).toBe(10_000);
  });

  it("eksport danych zawiera wpłaty (bez usuniętych)", async () => {
    const goal = await createGoal();
    const kept = (await deposit(goal.id, { amount: 10_000 }).expect(201)).body as GoalDeposit;
    const removed = (await deposit(goal.id, { amount: 2_000 }).expect(201)).body as GoalDeposit;
    await http().delete(`/goals/${goal.id}/deposits/${removed.id}`).set(as(me)).expect(204);

    expect((await get<ExportData>("/export")).goalDeposits).toEqual([kept]);
  });

  it("usunięcie konta kasuje też wpłaty", async () => {
    const goal = await createGoal();
    await deposit(goal.id, { amount: 10_000 }).expect(201);

    await http().delete("/users/me").set(as(me)).send({ password: TEST_PASSWORD }).expect(204);

    expect(await db.goalDeposit.count()).toBe(0);
  });
});
