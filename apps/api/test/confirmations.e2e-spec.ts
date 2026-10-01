import type { BudgetSummary, DueConfirmation, TransactionPage } from "@vireo/shared";
import request from "supertest";

import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp, TestSession } from "./helpers.js";
import { createTestApp, createTestDb, idOf, registerUser, resetDb, TestClock } from "./helpers.js";

/**
 * Potwierdzanie wpływów i stałych płatności. Co jest „do potwierdzenia”
 * i jak to zmienia budżet, liczy @vireo/shared (dueConfirmations,
 * assembleBudgetInput) — tu sprawdzamy klejenie: zapis odpowiedzi,
 * jej skutki w budżecie i historii, walidację i izolację użytkowników.
 */

const clock = new TestClock();

/** Czwartek 10.09.2026, 12:00 w Warszawie — dzień wypłaty i czynszu. */
const PAYDAY = "2026-09-10T10:00:00Z";
const monthlyOn10 = { frequency: "MONTHLY", startDate: "2026-09-10", dayOfMonth: 10 } as const;

describe("Potwierdzanie wpływów i płatności (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;
  let salaryId: string;
  let rentId: string;

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });
  const due = async (session: TestSession = me) =>
    (await http().get("/confirmations").set(as(session)).expect(200)).body as DueConfirmation[];
  const answer = (body: object, session: TestSession = me) =>
    http().post("/confirmations").set(as(session)).send(body);
  const budget = async () =>
    (await http().get("/budget/current").set(as(me)).expect(200)).body as BudgetSummary;
  const history = async () =>
    (
      await http()
        .get("/transactions?status=CONFIRMED&from=2026-09-10&to=2026-10-09")
        .set(as(me))
        .expect(200)
    ).body as TransactionPage;

  const confirmSalary = (extra: object = {}) =>
    answer({
      kind: "INCOME",
      incomeSourceId: salaryId,
      occurrenceDate: "2026-09-10",
      answer: "CONFIRMED",
      ...extra,
    });
  const answerRent = (rentAnswer: string, extra: object = {}) =>
    answer({
      kind: "EXPENSE",
      recurringRuleId: rentId,
      occurrenceDate: "2026-09-10",
      answer: rentAnswer,
      ...extra,
    });

  /** Pensja 5000 zł i czynsz 1500 zł, oba 10. dnia; wypłata też 10. */
  async function seed(session: TestSession): Promise<{ salaryId: string; rentId: string }> {
    await http().patch("/users/me").set(as(session)).send({ periodStartDay: 10 }).expect(200);
    const salary = await http()
      .post("/income/sources")
      .set(as(session))
      .send({ name: "Pensja", kind: "REGULAR", expectedAmount: 500_000, schedule: monthlyOn10 })
      .expect(201);
    const rent = await http()
      .post("/recurring-rules")
      .set(as(session))
      .send({ kind: "EXPENSE", name: "Czynsz", expectedAmount: 150_000, ...monthlyOn10 })
      .expect(201);
    // Baza nadaje createdAt z prawdziwego zegara, a test cofa „dziś” do 10.09;
    // zaległe liczą się od dnia dodania reguły, więc ustawiamy go jawnie.
    await db.recurringRule.updateMany({
      where: { userId: session.user.id },
      data: { createdAt: new Date(PAYDAY) },
    });
    return { salaryId: idOf(salary), rentId: idOf(rent) };
  }

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
    clock.set(PAYDAY);
    me = await registerUser(app);
    ({ salaryId, rentId } = await seed(me));
  });

  describe("GET /confirmations", () => {
    it("w dniu wypłaty: pensja i czynsz do potwierdzenia", async () => {
      expect(await due()).toEqual([
        {
          kind: "INCOME",
          id: salaryId,
          label: "Pensja",
          occurrenceDate: "2026-09-10",
          expectedAmount: 500_000,
          askToday: true,
          overdue: false,
        },
        {
          kind: "EXPENSE",
          id: rentId,
          label: "Czynsz",
          occurrenceDate: "2026-09-10",
          expectedAmount: 150_000,
          askToday: true,
          overdue: false,
        },
      ]);
    });

    it("dzień wcześniej nic nie czeka", async () => {
      clock.set("2026-09-09T10:00:00Z");
      expect(await due()).toEqual([]);
    });

    it("„dziś” w strefie użytkownika: 00:30 w Warszawie to już 10.09", async () => {
      clock.set("2026-09-09T22:30:00Z");
      expect((await due()).map((item) => item.label)).toEqual(["Pensja", "Czynsz"]);
    });

    it("zarchiwizowane źródło i wyłączona reguła nie czekają", async () => {
      await http().patch(`/income/sources/${salaryId}`).set(as(me)).send({ isActive: false });
      await http().patch(`/recurring-rules/${rentId}`).set(as(me)).send({ isActive: false });
      expect(await due()).toEqual([]);
    });
  });

  describe("wpływ: Tak / Inna kwota / Jeszcze nie", () => {
    it("Tak: oczekiwana kwota potwierdzona, budżet bez zmian, nic już nie czeka", async () => {
      const before = await budget();

      await confirmSalary().expect(204);

      expect((await due()).map((item) => item.kind)).toEqual(["EXPENSE"]);
      expect((await budget()).breakdown.periodIncome).toBe(500_000);
      expect((await budget()).availableBalance).toBe(before.availableBalance);
    });

    it("Inna kwota: budżet liczy faktyczny wpływ", async () => {
      await confirmSalary({ amount: 470_000 }).expect(204);

      expect((await budget()).breakdown.periodIncome).toBe(470_000);
    });

    it("w dniu wypłaty, przed potwierdzeniem: budżet liczy pensję, ale mówi, że jeszcze nie wpłynęła", async () => {
      const summary = await budget();
      expect(summary.breakdown.periodIncome).toBe(500_000);
      expect(summary.awaitingIncome).toBe(500_000);
    });

    it("dzień przed wypłatą nic się nie spóźnia", async () => {
      clock.set("2026-09-09T10:00:00Z");
      expect((await budget()).awaitingIncome).toBe(0);
    });

    it("po potwierdzeniu nic już nie czeka na wpływ", async () => {
      await confirmSalary().expect(204);
      expect((await budget()).awaitingIncome).toBe(0);
    });

    it("„Jeszcze nie”: dalej w budżecie i w „jeszcze nie wpłynęło”, jutro appka pyta znowu", async () => {
      await confirmSalary({ answer: "NOT_YET" }).expect(204);

      expect((await budget()).awaitingIncome).toBe(500_000);
      expect(await due()).toContainEqual(
        expect.objectContaining({ kind: "INCOME", askToday: false }),
      );
      clock.set("2026-09-11T10:00:00Z");
      expect(await due()).toContainEqual(
        expect.objectContaining({ kind: "INCOME", askToday: true }),
      );
    });

    it("„Nie w tym okresie” nie dotyczy wpływów", async () => {
      await confirmSalary({ answer: "SKIPPED" }).expect(400);
    });
  });

  describe("płatność: Tak / Inna kwota", () => {
    it("Tak: wydatek w historii z nazwą reguły, czynsz zamknięty, saldo bez zmian", async () => {
      const before = await budget();

      await answerRent("CONFIRMED").expect(204);

      const after = await budget();
      expect(after.fixedCommitments).toEqual([]);
      expect(after.breakdown.alreadySpent).toBe(150_000);
      expect(after.availableBalance).toBe(before.availableBalance);
      expect((await history()).items).toMatchObject([
        { amount: 150_000, date: "2026-09-10", note: "Czynsz", recurringRuleId: rentId },
      ]);
      expect((await due()).map((item) => item.kind)).toEqual(["INCOME"]);
    });

    it("Inna kwota: saldo maleje o różnicę", async () => {
      const before = await budget();

      await answerRent("CONFIRMED", { amount: 160_000 }).expect(204);

      expect((await budget()).availableBalance).toBe(before.availableBalance - 10_000);
    });

    it("potwierdzone dwa razy (powiadomienie i Dashboard) → jeden wydatek", async () => {
      await answerRent("CONFIRMED").expect(204);
      await answerRent("CONFIRMED").expect(204);

      expect((await history()).items).toHaveLength(1);
      expect((await budget()).breakdown.alreadySpent).toBe(150_000);
    });

    it("dzień po terminie: wydatek z datą potwierdzenia, nie terminu", async () => {
      clock.set("2026-09-12T10:00:00Z");

      await answerRent("CONFIRMED").expect(204);

      expect((await history()).items).toMatchObject([{ date: "2026-09-12" }]);
    });
  });

  describe("płatność: Jeszcze nie", () => {
    it("dalej odliczana z budżetu i widoczna, ale dziś appka już nie pyta", async () => {
      const before = await budget();

      await answerRent("NOT_YET").expect(204);

      expect(await budget()).toEqual(before);
      expect((await history()).items).toEqual([]);
      expect(await due()).toContainEqual(
        expect.objectContaining({ kind: "EXPENSE", askToday: false }),
      );
    });

    it("jutro pyta znowu", async () => {
      await answerRent("NOT_YET").expect(204);

      clock.set("2026-09-11T10:00:00Z");

      expect(await due()).toContainEqual(
        expect.objectContaining({ kind: "EXPENSE", askToday: true }),
      );
    });

    it("po „Jeszcze nie” da się potwierdzić — jeden wydatek w historii", async () => {
      await answerRent("NOT_YET").expect(204);
      clock.set("2026-09-11T10:00:00Z");

      await answerRent("CONFIRMED").expect(204);

      expect((await history()).items).toMatchObject([{ amount: 150_000, date: "2026-09-11" }]);
      expect((await due()).map((item) => item.kind)).toEqual(["INCOME"]);
    });
  });

  describe("płatność: Nie w tym okresie", () => {
    it("pominięta: kwota wraca do „Możesz wydać”, nic w historii, nic nie czeka", async () => {
      const before = await budget();

      await answerRent("SKIPPED").expect(204);

      const after = await budget();
      expect(after.fixedCommitments).toEqual([]);
      expect(after.breakdown.alreadySpent).toBe(0);
      expect(after.availableBalance).toBe(before.availableBalance + 150_000);
      expect((await history()).items).toEqual([]);
      expect((await due()).map((item) => item.kind)).toEqual(["INCOME"]);
    });
  });

  describe("zaległe z poprzedniego okresu", () => {
    /** 12.10 — nowy okres (10.10–9.11); wrześniowe terminy bez odpowiedzi. */
    const nextPeriod = () => {
      clock.set("2026-10-12T10:00:00Z");
    };

    it("nieodpowiedziany wrześniowy czynsz czeka jako zaległy i dalej jest odliczany", async () => {
      nextPeriod();

      const items = await due();
      expect(items.filter((item) => item.kind === "EXPENSE")).toEqual([
        expect.objectContaining({ occurrenceDate: "2026-09-10", overdue: true }),
        expect.objectContaining({ occurrenceDate: "2026-10-10", overdue: false }),
      ]);
      expect((await budget()).fixedCommitments).toEqual([
        { label: "Czynsz", amount: 150_000, overdue: true },
        { label: "Czynsz", amount: 150_000 },
      ]);
    });

    it("potwierdzony zaległy czynsz: wydatek z dzisiejszą datą, zaległość znika", async () => {
      nextPeriod();

      await answer({
        kind: "EXPENSE",
        recurringRuleId: rentId,
        occurrenceDate: "2026-09-10",
        answer: "CONFIRMED",
      }).expect(204);

      expect((await budget()).fixedCommitments).toEqual([{ label: "Czynsz", amount: 150_000 }]);
      const page = (
        await http()
          .get("/transactions?status=CONFIRMED&from=2026-10-10&to=2026-11-09")
          .set(as(me))
          .expect(200)
      ).body as TransactionPage;
      expect(page.items).toMatchObject([{ amount: 150_000, date: "2026-10-12" }]);
    });

    it("zaległa wrześniowa pensja: czeka, ale nie zwiększa budżetu, dopóki nie wpłynie", async () => {
      nextPeriod();

      expect(await due()).toContainEqual(
        expect.objectContaining({ kind: "INCOME", occurrenceDate: "2026-09-10", overdue: true }),
      );
      // Tylko październikowa pensja (10.10) — wrześniowej budżet nie liczy.
      expect((await budget()).breakdown.periodIncome).toBe(500_000);

      await answer({
        kind: "INCOME",
        incomeSourceId: salaryId,
        occurrenceDate: "2026-09-10",
        answer: "CONFIRMED",
      }).expect(204);
      expect((await budget()).breakdown.periodIncome).toBe(1_000_000);
    });
  });

  describe("zmiana odpowiedzi", () => {
    it("po zapłacie nie da się już odpowiedzieć „Jeszcze nie” ani „Nie w tym okresie”", async () => {
      await answerRent("CONFIRMED").expect(204);

      await answerRent("NOT_YET").expect(409);
      await answerRent("SKIPPED").expect(409);
    });

    it("wydatek usunięty z historii: płatność znów czeka, ponowne potwierdzenie go przywraca", async () => {
      await answerRent("CONFIRMED").expect(204);
      const [payment] = (await history()).items;
      await http()
        .delete(`/transactions/${payment?.id ?? ""}`)
        .set(as(me))
        .expect(204);

      expect((await due()).map((item) => item.kind)).toEqual(["INCOME", "EXPENSE"]);

      await answerRent("CONFIRMED", { amount: 155_000 }).expect(204);
      expect((await history()).items).toMatchObject([{ id: payment?.id, amount: 155_000 }]);
    });
  });

  describe("walidacja", () => {
    it("termin, którego reguła nie ma → 422", async () => {
      await answer({
        kind: "EXPENSE",
        recurringRuleId: rentId,
        occurrenceDate: "2026-09-11",
        answer: "CONFIRMED",
      }).expect(422);
    });

    it("termin w przyszłości → 422", async () => {
      await answer({
        kind: "EXPENSE",
        recurringRuleId: rentId,
        occurrenceDate: "2026-10-10",
        answer: "CONFIRMED",
      }).expect(422);
    });

    it("kwota tylko przy CONFIRMED, zawsze dodatnia i w groszach", async () => {
      await answerRent("NOT_YET", { amount: 150_000 }).expect(400);
      await answerRent("CONFIRMED", { amount: 0 }).expect(400);
      await answerRent("CONFIRMED", { amount: 99.5 }).expect(400);
    });
  });

  describe("izolacja użytkowników", () => {
    it("B nie widzi i nie potwierdza płatności A", async () => {
      const other = await registerUser(app);

      expect(await due(other)).toEqual([]);
      await answerRent("CONFIRMED").expect(204);
      await answer(
        {
          kind: "EXPENSE",
          recurringRuleId: rentId,
          occurrenceDate: "2026-09-10",
          answer: "SKIPPED",
        },
        other,
      ).expect(404);
      await answer(
        {
          kind: "INCOME",
          incomeSourceId: salaryId,
          occurrenceDate: "2026-09-10",
          answer: "CONFIRMED",
        },
        other,
      ).expect(404);
    });
  });
});
