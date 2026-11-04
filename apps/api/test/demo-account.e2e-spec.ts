import type { BudgetSummary, IncomeSource, PublicUser } from "@vireo/shared";
import request from "supertest";

import { DEMO_ACCOUNT, ensureDemoAccount } from "../prisma/demo-account.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp } from "./helpers.js";
import { createTestApp, createTestDb, resetDb } from "./helpers.js";

/**
 * `pnpm --filter api db:demo` — konto demo dla appki i testów e2e mobile
 * (Maestro) na świeżej bazie lokalnej: po onboardingu, z wypłatą, od razu
 * gotowe do logowania. Drugie uruchomienie niczego nie dubluje ani nie
 * nadpisuje.
 */
describe("Konto demo (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;
  const http = () => request(app.getHttpServer());

  const login = async () => {
    const res = await http()
      .post("/auth/login")
      .send({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password })
      .expect(200);
    return res.body as { accessToken: string; user: PublicUser };
  };

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
  });

  it("zakłada konto po onboardingu, z potwierdzonym adresem i wypłatą", async () => {
    expect(await ensureDemoAccount(db)).toBe("created");

    const session = await login();
    expect(session.user).toMatchObject({
      email: "demo@finso.app",
      onboardingCompleted: true,
      emailVerified: true,
      periodStartDay: 10,
    });
    const auth = { Authorization: `Bearer ${session.accessToken}` };
    const sources = (await http().get("/income/sources").set(auth).expect(200))
      .body as IncomeSource[];
    expect(sources).toEqual([
      expect.objectContaining({ name: "Wypłata", kind: "REGULAR", expectedAmount: 650_000 }),
    ]);
    const budget = (await http().get("/budget/current").set(auth).expect(200))
      .body as BudgetSummary;
    expect(budget.breakdown.periodIncome).toBe(650_000);
  });

  it("drugi raz: nic nie zmienia — dane z appki zostają", async () => {
    await ensureDemoAccount(db);
    const session = await login();
    await http()
      .post("/transactions")
      .set({ Authorization: `Bearer ${session.accessToken}` })
      .send({ amount: 1_000, date: "2026-10-15" })
      .expect(201);

    expect(await ensureDemoAccount(db)).toBe("exists");

    expect(await db.user.count()).toBe(1);
    expect(await db.incomeSource.count()).toBe(1);
    expect(await db.transaction.count()).toBe(1);
  });
});
