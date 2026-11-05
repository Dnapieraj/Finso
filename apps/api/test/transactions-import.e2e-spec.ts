import type { ImportResult, Transaction, TransactionPage } from "@vireo/shared";
import request from "supertest";

import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp, TestSession } from "./helpers.js";
import { createTestApp, createTestDb, idOf, registerUser, resetDb } from "./helpers.js";

/**
 * Import wyciągu: appka czyta CSV i wysyła wydatki; API zapisuje je
 * w jednej transakcji bazy i pomija te, które już są w Finso (ta sama data
 * i kwota) — inaczej wpisany ręcznie wydatek liczyłby się dwa razy.
 */
describe("Import wyciągu (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });
  const post = (path: string, body: object, session = me) =>
    http().post(path).set(as(session)).send(body);
  const list = async (session = me) =>
    (
      (await http().get("/transactions?limit=100").set(as(session)).expect(200))
        .body as TransactionPage
    ).items;

  const rows = [
    { date: "2026-10-03", amount: 4_590, note: "BIEDRONKA" },
    { date: "2026-10-03", amount: 4_590, note: "BIEDRONKA" },
    { date: "2026-10-07", amount: 129_900, note: null },
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
    me = await registerUser(app);
  });

  it("zapisuje wydatki: potwierdzone, bez kategorii, z notatką z banku", async () => {
    const res = await post("/transactions/import", { rows }).expect(201);

    expect(res.body as ImportResult).toEqual({ imported: 3, duplicates: 0 });
    const saved = await list();
    expect(saved).toHaveLength(3);
    expect(saved[0]).toMatchObject({
      date: "2026-10-07",
      amount: 129_900,
      note: null,
      categoryId: null,
      status: "CONFIRMED",
      recurringRuleId: null,
      beforeFinso: false,
    });
  });

  it("pomija wydatki już zapisane z tą samą datą i kwotą — każdy zapisany tylko raz", async () => {
    // Jedna ręcznie wpisana Biedronka: z dwóch w wyciągu pomijamy jedną.
    await post("/transactions", { date: "2026-10-03", amount: 4_590 }).expect(201);

    const res = await post("/transactions/import", { rows }).expect(201);

    expect(res.body as ImportResult).toEqual({ imported: 2, duplicates: 1 });
    expect(await list()).toHaveLength(3);
  });

  it("ten sam plik drugi raz: wszystko pominięte", async () => {
    await post("/transactions/import", { rows }).expect(201);

    const res = await post("/transactions/import", { rows }).expect(201);

    expect(res.body as ImportResult).toEqual({ imported: 0, duplicates: 3 });
  });

  it("wydatek w koszu nie blokuje importu", async () => {
    const trashed = idOf(await post("/transactions", { date: "2026-10-07", amount: 129_900 }));
    await http().delete(`/transactions/${trashed}`).set(as(me)).expect(204);

    const res = await post("/transactions/import", { rows: [rows[2]] }).expect(201);

    expect(res.body as ImportResult).toEqual({ imported: 1, duplicates: 0 });
  });

  it("Idempotency-Key: ponowienie zwraca pierwszy wynik i niczego nie dubluje", async () => {
    const key = "01923b6e-0000-7000-8000-0000000000aa";
    const first = await post("/transactions/import", { rows })
      .set("Idempotency-Key", key)
      .expect(201);
    const again = await post("/transactions/import", { rows })
      .set("Idempotency-Key", key)
      .expect(201);

    expect(again.body).toEqual(first.body);
    expect(again.headers["idempotent-replayed"]).toBe("true");
    expect(await list()).toHaveLength(3);
  });

  it.each([
    ["bez wierszy", { rows: [] }],
    ["zła data", { rows: [{ ...rows[0], date: "2026-02-30" }] }],
    ["kwota 0", { rows: [{ ...rows[0], amount: 0 }] }],
  ])("odrzuca: %s → 400, nic nie zapisuje", async (_case, body) => {
    await post("/transactions/import", body).expect(400);

    expect(await db.transaction.count()).toBe(0);
  });

  it("izolacja: duplikaty liczone tylko wśród własnych wydatków", async () => {
    const bob = await registerUser(app);
    await post("/transactions", { date: "2026-10-03", amount: 4_590 }, bob).expect(201);

    const res = await post("/transactions/import", { rows: [rows[0]] }).expect(201);

    expect(res.body as ImportResult).toEqual({ imported: 1, duplicates: 0 });
    const bobs = await list(bob);
    expect(bobs.map((tx: Transaction) => tx.note)).toEqual([null]);
  });
});
