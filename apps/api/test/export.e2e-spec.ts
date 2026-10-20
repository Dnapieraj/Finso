import type { ExportData } from "@vireo/shared";
import request from "supertest";

import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp, TestSession } from "./helpers.js";
import { createTestApp, createTestDb, idOf, registerUser, resetDb, TestClock } from "./helpers.js";

/**
 * `GET /export` — kopia danych do plików CSV (RODO, art. 20): wszystko, co
 * użytkownik wpisał i widzi w appce, naraz i bez stronicowania. Kosz jest
 * poza eksportem — tych wpisów appka też już nie pokazuje.
 */
describe("Eksport danych (e2e)", () => {
  const clock = new TestClock();
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });
  const post = (path: string, body: object, session = me) =>
    http().post(path).set(as(session)).send(body);
  const exportOf = async (session = me) =>
    (await http().get("/export").set(as(session)).expect(200)).body as ExportData;

  beforeAll(async () => {
    app = await createTestApp((builder) => builder.overrideProvider(CLOCK).useValue(clock));
    db = createTestDb();
  });

  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  beforeEach(async () => {
    clock.set("2026-10-20T21:30:00Z"); // 20.10, 23:30 w Warszawie
    await resetDb(db);
    me = await registerUser(app);
  });

  it("nowe konto: puste listy i dzień eksportu w strefie użytkownika", async () => {
    clock.set("2026-10-20T22:30:00Z"); // 21.10, 0:30 w Warszawie

    expect(await exportOf()).toEqual({
      exportedOn: "2026-10-21",
      categories: [],
      expenses: [],
      incomeSources: [],
      incomeEntries: [],
      goals: [],
      recurringRules: [],
    });
  });

  it("wszystko, co wpisano: wydatki, źródła i wpływy, cele, stałe płatności, kategorie", async () => {
    const food = await db.category.create({
      data: { userId: null, name: "Jedzenie", icon: "food", color: "#4d7c0f" },
    });
    for (const day of ["2026-10-01", "2026-10-15"]) {
      await post("/transactions", {
        amount: 4_590,
        date: day,
        categoryId: food.id,
        note: "Obiad",
      }).expect(201);
    }
    const source = idOf(
      await post("/income/sources", {
        name: "Wypłata",
        kind: "REGULAR",
        expectedAmount: 500_000,
      }).expect(201),
    );
    await post("/income/entries", {
      incomeSourceId: source,
      amount: 500_000,
      date: "2026-10-10",
      status: "CONFIRMED",
    }).expect(201);
    await post("/goals", { name: "Rower", targetAmount: 300_000, targetDate: "2027-06-30" }).expect(
      201,
    );
    await post("/recurring-rules", {
      kind: "EXPENSE",
      name: "Czynsz",
      frequency: "MONTHLY",
      startDate: "2026-10-05",
      dayOfMonth: 5,
      expectedAmount: 150_000,
    }).expect(201);

    const data = await exportOf();

    expect(data.categories.map((category) => category.name)).toEqual(["Jedzenie"]);
    // Od najstarszych — tak czyta się historię w arkuszu.
    expect(data.expenses.map((expense) => [expense.date, expense.amount, expense.note])).toEqual([
      ["2026-10-01", 4_590, "Obiad"],
      ["2026-10-15", 4_590, "Obiad"],
    ]);
    expect(data.expenses[0]).toMatchObject({ occurrenceDate: null, status: "CONFIRMED" });
    expect(data.incomeSources.map((item) => item.name)).toEqual(["Wypłata"]);
    expect(data.incomeEntries).toEqual([
      expect.objectContaining({ incomeSourceId: source, amount: 500_000, date: "2026-10-10" }),
    ]);
    expect(data.goals.map((goal) => goal.name)).toEqual(["Rower"]);
    expect(data.recurringRules.map((rule) => rule.name)).toEqual(["Czynsz"]);
  });

  it("wpisy w koszu nie trafiają do eksportu", async () => {
    const kept = idOf(
      await post("/transactions", { amount: 1_000, date: "2026-10-01" }).expect(201),
    );
    const trashed = idOf(
      await post("/transactions", { amount: 2_000, date: "2026-10-02" }).expect(201),
    );
    await http().delete(`/transactions/${trashed}`).set(as(me)).expect(204);

    expect((await exportOf()).expenses.map((expense) => expense.id)).toEqual([kept]);
  });

  it("tylko dane zalogowanego użytkownika", async () => {
    const bob = await registerUser(app);
    await post("/transactions", { amount: 9_999, date: "2026-10-01" }, bob).expect(201);
    await post(
      "/goals",
      { name: "Auto Boba", targetAmount: 1_000, targetDate: "2027-01-31" },
      bob,
    ).expect(201);

    const data = await exportOf();

    expect(data.expenses).toEqual([]);
    expect(data.goals).toEqual([]);
  });

  it("bez tokena → 401", async () => {
    await http().get("/export").expect(401);
  });
});
