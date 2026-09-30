import type { TransactionSummary } from "@vireo/shared";
import request from "supertest";

import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp, TestSession, ValidationErrorBody } from "./helpers.js";
import { createTestApp, createTestDb, idOf, registerUser, resetDb } from "./helpers.js";

/**
 * Sumy do wykresu „wydatki wg kategorii” liczy baza, a nie appka z listy
 * — lista jest stronicowana, a wykres ma być dokładny dla całego okresu.
 * Liczą się te same wydatki co w budżecie: potwierdzone, nie w koszu.
 */
describe("GET /transactions/summary (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;
  let food: string;
  let transport: string;

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });
  const spend = (body: object, session: TestSession = me) =>
    http().post("/transactions").set(as(session)).send(body).expect(201);
  const summary = (query: string, session: TestSession = me) =>
    http().get(`/transactions/summary${query}`).set(as(session));
  const september = "?from=2026-09-10&to=2026-10-09";

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
    food = (
      await db.category.create({
        data: { userId: null, name: "Jedzenie", icon: "food", color: "#F59E0B" },
      })
    ).id;
    transport = (
      await db.category.create({
        data: { userId: null, name: "Transport", icon: "car", color: "#3B82F6" },
      })
    ).id;
  });

  it("sumuje wydatki okresu per kategoria, od największej; bez kategorii jako null", async () => {
    await spend({ amount: 20_000, date: "2026-09-10", categoryId: food });
    await spend({ amount: 25_000, date: "2026-10-09", categoryId: food });
    await spend({ amount: 30_000, date: "2026-09-20", categoryId: transport });
    await spend({ amount: 1_000, date: "2026-09-21" });

    const res = await summary(september).expect(200);

    expect(res.body).toEqual({
      total: 76_000,
      count: 4,
      byCategory: [
        { categoryId: food, amount: 45_000, count: 2 },
        { categoryId: transport, amount: 30_000, count: 1 },
        { categoryId: null, amount: 1_000, count: 1 },
      ],
    });
  });

  it("liczy to samo co budżet: bez wydatków spoza okresu, w koszu i oczekujących", async () => {
    await spend({ amount: 10_000, date: "2026-09-15", categoryId: food });
    // Dzień przed i dzień po okresie.
    await spend({ amount: 99_000, date: "2026-09-09", categoryId: food });
    await spend({ amount: 99_000, date: "2026-10-10", categoryId: food });
    const trashed = await spend({ amount: 99_000, date: "2026-09-15", categoryId: food });
    await http()
      .delete(`/transactions/${idOf(trashed)}`)
      .set(as(me))
      .expect(204);
    await spend({ amount: 99_000, date: "2026-09-15", categoryId: food, status: "PENDING" });

    const res = await summary(september).expect(200);

    expect(res.body).toEqual({
      total: 10_000,
      count: 1,
      byCategory: [{ categoryId: food, amount: 10_000, count: 1 }],
    });
  });

  it("wydatek przywrócony z kosza wraca do sum", async () => {
    const coffee = await spend({ amount: 1_500, date: "2026-09-15", categoryId: food });
    await http()
      .delete(`/transactions/${idOf(coffee)}`)
      .set(as(me))
      .expect(204);
    await http()
      .post(`/transactions/${idOf(coffee)}/restore`)
      .set(as(me))
      .expect(200);

    expect(((await summary(september).expect(200)).body as TransactionSummary).total).toBe(1_500);
  });

  it("pusty okres: zero i pusta lista", async () => {
    expect((await summary(september).expect(200)).body).toEqual({
      total: 0,
      count: 0,
      byCategory: [],
    });
  });

  it("nie widzi wydatków innego użytkownika", async () => {
    const other = await registerUser(app);
    await spend({ amount: 50_000, date: "2026-09-15", categoryId: food }, other);

    expect(((await summary(september).expect(200)).body as TransactionSummary).total).toBe(0);
  });

  it("bez zakresu dat: 400", async () => {
    const res = await summary("?from=2026-09-10").expect(400);

    expect((res.body as ValidationErrorBody).errors).toEqual([
      expect.objectContaining({ path: ["to"] }),
    ]);
  });

  it("„od” po „do”: 400", async () => {
    const res = await summary("?from=2026-10-10&to=2026-10-09").expect(400);

    expect((res.body as ValidationErrorBody).errors).toEqual([
      expect.objectContaining({ path: ["to"], message: "before_from" }),
    ]);
  });

  it("nie myli ścieżki z GET /transactions/:id", async () => {
    await summary(september).expect(200);
    await http().get("/transactions/01923b6e-0000-7000-8000-00000000dead").set(as(me)).expect(404);
  });

  it("wymaga zalogowania", async () => {
    await http().get(`/transactions/summary${september}`).expect(401);
  });
});
