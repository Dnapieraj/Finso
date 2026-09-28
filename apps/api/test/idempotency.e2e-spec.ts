import type { Transaction } from "@vireo/shared";
import request from "supertest";

import type { Clock } from "../src/common/clock.js";
import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { IdempotencyService } from "../src/idempotency/idempotency.service.js";
import type { TestApp, TestSession } from "./helpers.js";
import { createTestApp, createTestDb, idOf, registerUser, resetDb } from "./helpers.js";

/** Zegar, który test może przesunąć — do sprawdzenia wygasania kluczy. */
class TestClock implements Clock {
  private current = new Date("2026-09-28T12:00:00Z");

  now(): Date {
    return this.current;
  }

  set(iso: string): void {
    this.current = new Date(iso);
  }
}

const clock = new TestClock();

const KEY = "0199a1b2-0000-7000-8000-000000000001";
const expense = { amount: 4_590, date: "2026-09-28" };

describe("Idempotency-Key dla POST /transactions (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });
  const create = (body: object, key?: string, session: TestSession = me) => {
    const req = http().post("/transactions").set(as(session));
    return (key ? req.set("Idempotency-Key", key) : req).send(body);
  };
  const countTransactions = (session: TestSession = me) =>
    db.transaction.count({ where: { userId: session.user.id } });

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

  it("bez klucza działa jak dotąd: każde żądanie to nowy wydatek", async () => {
    await create(expense).expect(201);
    await create(expense).expect(201);

    expect(await countTransactions()).toBe(2);
  });

  it("ten sam klucz dwa razy zapisuje jeden wydatek i zwraca tę samą odpowiedź", async () => {
    const first = await create(expense, KEY).expect(201);
    const retry = await create(expense, KEY).expect(201);

    expect(retry.body).toEqual(first.body);
    expect(retry.headers["idempotent-replayed"]).toBe("true");
    expect(first.headers["idempotent-replayed"]).toBeUndefined();
    expect(await countTransactions()).toBe(1);
  });

  // Wydatek i klucz powstają w jednej transakcji bazy: konflikt unikalnego
  // indeksu klucza wycofuje też duplikat wydatku.
  it("jednoczesne żądania z tym samym kluczem: dokładnie jeden wydatek, ta sama odpowiedź", async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => create(expense, KEY)));

    for (const res of responses) {
      expect(res.status).toBe(201);
      expect(res.body).toEqual(responses[0]?.body);
    }
    expect(await countTransactions()).toBe(1);
    expect(await db.idempotencyKey.count({ where: { userId: me.user.id } })).toBe(1);
  });

  it.each([
    ["inną kwotą", { ...expense, amount: 4_591 }],
    ["inną datą", { ...expense, date: "2026-09-27" }],
    ["inną notatką", { ...expense, note: "kawa" }],
  ])("ten sam klucz z %s to błąd 422, a nie cichy zapis", async (_case, changed) => {
    await create(expense, KEY).expect(201);

    const res = await create(changed, KEY).expect(422);

    expect((res.body as { message: string }).message).toBe(
      "Idempotency-Key was already used with a different request",
    );
    expect(await countTransactions()).toBe(1);
  });

  it("klucze są per użytkownik: B z kluczem A zapisuje własny wydatek", async () => {
    const other = await registerUser(app);
    const mine = await create(expense, KEY).expect(201);

    const theirs = await create(expense, KEY, other).expect(201);

    expect(idOf(theirs)).not.toBe(idOf(mine));
    expect(theirs.headers["idempotent-replayed"]).toBeUndefined();
    expect(await countTransactions(me)).toBe(1);
    expect(await countTransactions(other)).toBe(1);
  });

  it("klucz działa przez 24 h — tuż przed upływem to nadal powtórka", async () => {
    const first = await create(expense, KEY).expect(201);
    clock.set("2026-09-29T11:59:59Z");

    const retry = await create(expense, KEY).expect(201);

    expect(idOf(retry)).toBe(idOf(first));
    expect(await countTransactions()).toBe(1);
  });

  it("po 24 h klucz wygasa: ten sam klucz zapisuje nowy wydatek", async () => {
    const first = await create(expense, KEY).expect(201);
    clock.set("2026-09-29T12:00:00Z");

    const later = await create(expense, KEY).expect(201);

    expect(idOf(later)).not.toBe(idOf(first));
    expect(await countTransactions()).toBe(2);
  });

  it("powtórka po usunięciu wydatku nie wskrzesza go ani nie tworzy nowego", async () => {
    const first = await create(expense, KEY).expect(201);
    await http()
      .delete(`/transactions/${idOf(first)}`)
      .set(as(me))
      .expect(204);

    const retry = await create(expense, KEY).expect(201);

    expect(retry.body as Transaction).toEqual(first.body as Transaction);
    await http()
      .get(`/transactions/${idOf(first)}`)
      .set(as(me))
      .expect(404);
    expect(await countTransactions()).toBe(1);
  });

  it("żądanie odrzucone walidacją nie zużywa klucza", async () => {
    await create({ ...expense, amount: -1 }, KEY).expect(400);

    await create(expense, KEY).expect(201);

    expect(await countTransactions()).toBe(1);
  });

  it.each([
    ["nie-UUID", "abc"],
    ["pusty", " "],
    ["za długi", "a".repeat(300)],
  ])("klucz w złym formacie (%s) to 400", async (_case, key) => {
    await create(expense, key).expect(400);

    expect(await countTransactions()).toBe(0);
  });

  describe("sprzątanie wygasłych kluczy", () => {
    /** Klucz zapisany wprost w bazie, z datą wygaśnięcia z testu. */
    const storeKey = (session: TestSession, key: string, expiresAt: string) =>
      db.idempotencyKey.create({
        data: {
          userId: session.user.id,
          scope: "POST /transactions",
          key,
          requestHash: "0".repeat(64),
          responseStatus: 201,
          responseBody: {},
          expiresAt: new Date(expiresAt),
        },
      });
    const keysLeft = async () =>
      (await db.idempotencyKey.findMany({ orderBy: { key: "asc" } })).map((row) => row.key);

    it("zadanie cykliczne usuwa wygasłe klucze wszystkich użytkowników, ważne zostawia", async () => {
      // Użytkownik, który przestał korzystać z appki — nic nie zapisuje.
      const inactive = await registerUser(app);
      await storeKey(inactive, "0199a1b2-0000-7000-8000-00000000000a", "2026-09-28T11:59:59Z");
      await storeKey(me, "0199a1b2-0000-7000-8000-00000000000b", "2026-09-28T11:00:00Z");
      await storeKey(me, "0199a1b2-0000-7000-8000-00000000000c", "2026-09-28T12:00:01Z");

      await app.get(IdempotencyService).purgeExpired();

      expect(await keysLeft()).toEqual(["0199a1b2-0000-7000-8000-00000000000c"]);
    });

    it("zapis z kluczem też sprząta wygasłe klucze, także cudze", async () => {
      const other = await registerUser(app);
      await storeKey(other, "0199a1b2-0000-7000-8000-00000000000a", "2026-09-28T11:00:00Z");

      await create(expense, KEY).expect(201);

      expect(await keysLeft()).toEqual([KEY]);
    });

    it("wygasły klucz nie jest używany do powtórki, zanim sprzątanie go usunie", async () => {
      await storeKey(me, KEY, "2026-09-28T11:00:00Z");

      const res = await create(expense, KEY).expect(201);

      expect(res.headers["idempotent-replayed"]).toBeUndefined();
      expect(await countTransactions()).toBe(1);
    });
  });
});
