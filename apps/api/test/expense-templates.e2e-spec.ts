import type { ExpenseTemplate } from "@vireo/shared";
import request from "supertest";

import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp, TestSession, ValidationErrorBody } from "./helpers.js";
import { anyString, createTestApp, createTestDb, idOf, registerUser, resetDb } from "./helpers.js";

/**
 * Szablony szybkiego dodawania („Kawa 14 zł”): nazwa, kwota i kategoria,
 * z których appka zapisuje wydatek jednym tapnięciem. To ustawienie, nie
 * dane finansowe — usuwane naprawdę, bez kosza.
 */
describe("Szablony wydatków (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;
  let food: { id: string };

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${me.accessToken}` });
  const get = (path: string) => http().get(path).set(auth());
  const post = (path: string, body: object) => http().post(path).set(auth()).send(body);
  const patch = (path: string, body: object) => http().patch(path).set(auth()).send(body);
  const del = (path: string) => http().delete(path).set(auth());

  const coffee = () => ({ name: "Kawa", amount: 1_400, categoryId: food.id });

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
    food = await db.category.create({
      data: { userId: null, name: "Jedzenie", icon: "food", color: "#4d7c0f" },
    });
  });

  it("tworzy szablon i zwraca go w liście", async () => {
    const created = await post("/expense-templates", coffee()).expect(201);

    expect(created.body).toEqual({ id: anyString, ...coffee() });
    expect((await get("/expense-templates").expect(200)).body).toEqual([created.body]);
  });

  it("nazwa bez spacji na brzegach", async () => {
    const res = await post("/expense-templates", { ...coffee(), name: "  Kawa  " }).expect(201);

    expect((res.body as ExpenseTemplate).name).toBe("Kawa");
  });

  it("lista w kolejności dodania — tak jak na ekranie szybkiego dodawania", async () => {
    await post("/expense-templates", { ...coffee(), name: "Kawa" }).expect(201);
    await post("/expense-templates", { ...coffee(), name: "Bilet", amount: 480 }).expect(201);
    await post("/expense-templates", { ...coffee(), name: "Obiad", amount: 3_200 }).expect(201);

    const names = ((await get("/expense-templates").expect(200)).body as ExpenseTemplate[]).map(
      (template) => template.name,
    );
    expect(names).toEqual(["Kawa", "Bilet", "Obiad"]);
  });

  it.each([
    ["pusta nazwa", { name: "   " }],
    ["nazwa dłuższa niż 40 znaków", { name: "x".repeat(41) }],
    ["kwota 0", { amount: 0 }],
    ["kwota ułamkowa", { amount: 12.5 }],
    ["brak kategorii", { categoryId: undefined }],
    ["kategoria, która nie jest id", { categoryId: "jedzenie" }],
  ])("odrzuca: %s → 400", async (_case, change) => {
    await post("/expense-templates", { ...coffee(), ...change }).expect(400);
  });

  it("kategoria, której nie ma → 400 unknown_reference, nic nie zapisane", async () => {
    const res = await post("/expense-templates", {
      ...coffee(),
      categoryId: "01923b6e-0000-7000-8000-00000000dead",
    }).expect(400);

    expect((res.body as ValidationErrorBody).errors).toEqual([
      expect.objectContaining({ code: "unknown_reference", path: ["categoryId"] }),
    ]);

    expect(await db.expenseTemplate.count()).toBe(0);
  });

  it("może używać własnej kategorii", async () => {
    const own = await post("/categories", { name: "Hobby", icon: "star", color: "#123456" }).expect(
      201,
    );

    await post("/expense-templates", { ...coffee(), categoryId: idOf(own) }).expect(201);
  });

  it("PATCH zmienia tylko podane pola", async () => {
    const created = await post("/expense-templates", coffee()).expect(201);

    const res = await patch(`/expense-templates/${idOf(created)}`, { amount: 1_600 }).expect(200);

    expect(res.body).toEqual({ ...(created.body as ExpenseTemplate), amount: 1_600 });
  });

  it("PATCH z pustą nazwą albo bez kategorii → 400", async () => {
    const created = await post("/expense-templates", coffee()).expect(201);

    await patch(`/expense-templates/${idOf(created)}`, { name: "" }).expect(400);
    await patch(`/expense-templates/${idOf(created)}`, { categoryId: null }).expect(400);
  });

  it("DELETE usuwa naprawdę (to ustawienie, nie dane finansowe)", async () => {
    const created = await post("/expense-templates", coffee()).expect(201);

    await del(`/expense-templates/${idOf(created)}`).expect(204);

    expect(await db.expenseTemplate.count()).toBe(0);
    await del(`/expense-templates/${idOf(created)}`).expect(404);
  });

  it("usunięta kategoria zostawia szablon bez kategorii — appka poprosi o nową", async () => {
    const own = await post("/categories", { name: "Hobby", icon: "star", color: "#123456" }).expect(
      201,
    );
    const created = await post("/expense-templates", { ...coffee(), categoryId: idOf(own) }).expect(
      201,
    );

    await del(`/categories/${idOf(own)}`).expect(204);

    expect((await get("/expense-templates").expect(200)).body).toEqual([
      { ...(created.body as ExpenseTemplate), categoryId: null },
    ]);
  });

  it("bez logowania → 401", async () => {
    await http().get("/expense-templates").expect(401);
  });
});
