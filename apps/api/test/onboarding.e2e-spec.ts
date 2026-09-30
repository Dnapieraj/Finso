import type {
  BudgetSummary,
  CompleteOnboardingRequest,
  IncomeEntryPage,
  IncomeSource,
  PublicUser,
  RecurringRule,
  TransactionPage,
} from "@vireo/shared";
import request from "supertest";

import { seedSystemCategories } from "../prisma/system-categories.js";
import { OTHER_CATEGORY_ID } from "../src/categories/system-category-ids.js";

import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp, TestSession, ValidationErrorBody } from "./helpers.js";
import {
  anyString,
  createTestApp,
  createTestDb,
  registerUser,
  resetDb,
  TestClock,
} from "./helpers.js";

/**
 * Onboarding to jeden zapis: ustawienia okresu, dochód i stałe
 * zobowiązania powstają razem z flagą „ukończony” albo wcale. Serwer sam
 * liczy „dziś” w strefie z onboardingu i od niego datę startu reguł, żeby
 * Dashboard od razu pokazał prawdziwy budżet bieżącego okresu.
 */

const clock = new TestClock();

describe("Onboarding (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;
  let billsId: string;

  const http = () => request(app.getHttpServer());
  const as = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });
  const get = async <T>(path: string, session: TestSession = me) =>
    (await http().get(path).set(as(session)).expect(200)).body as T;
  const complete = (body: object, session: TestSession = me) =>
    http().post("/users/me/onboarding").set(as(session)).send(body);

  /** Pensja 8000 zł 10. dnia, okres od 10., czynsz 2500 zł 5. i internet 60 zł 20. dnia. */
  function typical(overrides: Partial<CompleteOnboardingRequest> = {}): CompleteOnboardingRequest {
    return {
      periodStartDay: 10,
      timezone: "Europe/Warsaw",
      income: { kind: "REGULAR", name: "Wypłata", amount: 800_000, dayOfMonth: 10 },
      commitments: [
        { name: "Czynsz", amount: 250_000, dayOfMonth: 5, categoryId: billsId },
        { name: "Internet", amount: 6_000, dayOfMonth: 20, categoryId: billsId },
      ],
      ...overrides,
    };
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
    // Środa 23.09.2026, 12:00 w Warszawie.
    clock.set("2026-09-23T10:00:00Z");
    await seedSystemCategories(db);
    billsId = (
      await db.category.create({
        data: { userId: null, name: "Rachunki", icon: "bills", color: "#b45309" },
      })
    ).id;
    me = await registerUser(app);
  });

  it("nowe konto nie ma za sobą onboardingu", async () => {
    expect(me.user).toMatchObject({ onboardingCompleted: false });
    expect(await get<PublicUser>("/users/me")).toMatchObject({ onboardingCompleted: false });
  });

  describe("POST /users/me/onboarding", () => {
    it("zapisuje ustawienia okresu i zwraca użytkownika z ukończonym onboardingiem", async () => {
      const res = await complete(typical({ timezone: "Europe/Berlin" })).expect(200);

      expect(res.body).toEqual({
        id: me.user.id,
        email: me.user.email,
        plan: "FREE",
        currency: "PLN",
        timezone: "Europe/Berlin",
        periodStartDay: 10,
        onboardingCompleted: true,
      });
      expect(await get<PublicUser>("/users/me")).toEqual(res.body);
    });

    it("dochód regularny: źródło z kwotą i miesięczny harmonogram od początku bieżącego okresu", async () => {
      await complete(typical({ commitments: [] })).expect(200);

      const [rule] = await get<RecurringRule[]>("/recurring-rules");
      expect(rule).toEqual({
        id: anyString,
        kind: "INCOME",
        name: null,
        frequency: "MONTHLY",
        interval: 1,
        // Okres 10.09–9.10: od jego początku, żeby wrześniowa wypłata
        // też była dochodem tego okresu.
        startDate: "2026-09-10",
        dayOfMonth: 10,
        dayOfWeek: null,
        expectedAmount: null,
        categoryId: null,
        isActive: true,
      });
      expect(await get<IncomeSource[]>("/income/sources")).toEqual([
        {
          id: anyString,
          name: "Wypłata",
          kind: "REGULAR",
          expectedAmount: 800_000,
          recurringRuleId: rule?.id,
          isActive: true,
          schedule: {
            frequency: "MONTHLY",
            interval: 1,
            startDate: "2026-09-10",
            dayOfMonth: 10,
            dayOfWeek: null,
          },
        },
      ]);
    });

    it("stałe zobowiązania: reguły wydatków z nazwą, kwotą, dniem i kategorią", async () => {
      await complete(typical()).expect(200);

      const expenses = (await get<RecurringRule[]>("/recurring-rules")).filter(
        (rule) => rule.kind === "EXPENSE",
      );
      expect(expenses).toEqual([
        expect.objectContaining({
          name: "Czynsz",
          frequency: "MONTHLY",
          interval: 1,
          startDate: "2026-09-10",
          dayOfMonth: 5,
          expectedAmount: 250_000,
          categoryId: billsId,
          isActive: true,
        }),
        expect.objectContaining({ name: "Internet", dayOfMonth: 20, expectedAmount: 6_000 }),
      ]);
    });

    it("Dashboard od razu pokazuje prawdziwy budżet okresu", async () => {
      await complete(typical()).expect(200);

      const summary = await get<BudgetSummary>("/budget/current");
      // 800 000 − czynsz 250 000 (5.10) − internet 6 000 (20.09) = 544 000;
      // 23.09–9.10 to 17 dni → 32 000 dziennie.
      expect(summary).toMatchObject({
        period: { start: "2026-09-10", end: "2026-10-09" },
        availableBalance: 544_000,
        daysRemaining: 17,
        dailyAllowance: 32_000,
        breakdown: {
          periodIncome: 800_000,
          fixedCommitments: 256_000,
          goalContributions: 0,
          alreadySpent: 0,
        },
        fixedCommitments: [
          { label: "Czynsz", amount: 250_000 },
          { label: "Internet", amount: 6_000 },
        ],
      });
    });

    it("przed dniem wypłaty bieżący okres zaczął się w poprzednim miesiącu", async () => {
      clock.set("2026-09-05T10:00:00Z");

      await complete(typical({ commitments: [] })).expect(200);

      const [rule] = await get<RecurringRule[]>("/recurring-rules");
      expect(rule?.startDate).toBe("2026-08-10");
      expect((await get<BudgetSummary>("/budget/current")).breakdown.periodIncome).toBe(800_000);
    });

    it("zobowiązania można pominąć", async () => {
      await complete(typical({ commitments: [] })).expect(200);

      const rules = await get<RecurringRule[]>("/recurring-rules");
      expect(rules.map((rule) => rule.kind)).toEqual(["INCOME"]);
    });

    describe("dochód nieregularny", () => {
      const irregular = (receivedThisPeriod: number | null) =>
        typical({
          income: { kind: "IRREGULAR", name: "Zlecenia", receivedThisPeriod },
          commitments: [],
        });

      it("źródło bez kwoty i bez harmonogramu", async () => {
        await complete(irregular(null)).expect(200);

        expect(await get<IncomeSource[]>("/income/sources")).toEqual([
          {
            id: anyString,
            name: "Zlecenia",
            kind: "IRREGULAR",
            expectedAmount: null,
            recurringRuleId: null,
            isActive: true,
            schedule: null,
          },
        ]);
        expect(await get<RecurringRule[]>("/recurring-rules")).toEqual([]);
        expect((await get<IncomeEntryPage>("/income/entries")).items).toEqual([]);
        expect((await get<BudgetSummary>("/budget/current")).breakdown.periodIncome).toBe(0);
      });

      it("to, co już wpłynęło, zapisuje jako potwierdzony wpływ z dzisiejszą datą", async () => {
        await complete(irregular(120_000)).expect(200);

        const [source] = await get<IncomeSource[]>("/income/sources");
        expect((await get<IncomeEntryPage>("/income/entries")).items).toEqual([
          {
            id: anyString,
            incomeSourceId: source?.id,
            amount: 120_000,
            date: "2026-09-23",
            status: "CONFIRMED",
          },
        ]);
        expect((await get<BudgetSummary>("/budget/current")).breakdown.periodIncome).toBe(120_000);
      });
    });

    describe("wydatki od ostatniej wypłaty", () => {
      it("zapisuje je jako jeden wydatek „Wydatki przed Finso” w kategorii Inne, z dzisiejszą datą", async () => {
        await complete(typical({ spentThisPeriod: 45_000 })).expect(200);

        expect((await get<TransactionPage>("/transactions")).items).toEqual([
          {
            id: anyString,
            amount: 45_000,
            date: "2026-09-23",
            categoryId: OTHER_CATEGORY_ID,
            recurringRuleId: null,
            note: "Wydatki przed Finso",
            status: "CONFIRMED",
          },
        ]);
      });

      it("pierwszy Dashboard nie pokazuje za dużo", async () => {
        await complete(typical({ spentThisPeriod: 45_000 })).expect(200);

        // 544 000 − 45 000 = 499 000; /17 dni → floor 29 352.
        expect(await get<BudgetSummary>("/budget/current")).toMatchObject({
          availableBalance: 499_000,
          dailyAllowance: 29_352,
          breakdown: { alreadySpent: 45_000 },
        });
      });

      it("pominięte: żadnego wydatku", async () => {
        await complete(typical()).expect(200);

        expect((await get<TransactionPage>("/transactions")).items).toEqual([]);
      });

      it("bez kategorii Inne w bazie (baza bez seeda) wydatek zapisuje się bez kategorii", async () => {
        await db.category.delete({ where: { id: OTHER_CATEGORY_ID } });

        await complete(typical({ spentThisPeriod: 45_000 })).expect(200);

        const [expense] = (await get<TransactionPage>("/transactions")).items;
        expect(expense).toMatchObject({ amount: 45_000, categoryId: null });
      });
    });

    describe("„dziś” w strefie z onboardingu, nie serwera", () => {
      it("Nowy Jork: 1.10 02:00 UTC to jeszcze 30.09", async () => {
        clock.set("2026-10-01T02:00:00Z");

        await complete({
          periodStartDay: 1,
          timezone: "America/New_York",
          income: { kind: "IRREGULAR", name: "Zlecenia", receivedThisPeriod: 50_000 },
          commitments: [{ name: "Czynsz", amount: 250_000, dayOfMonth: 5, categoryId: billsId }],
          spentThisPeriod: 45_000,
        }).expect(200);

        const [rule] = await get<RecurringRule[]>("/recurring-rules");
        expect(rule?.startDate).toBe("2026-09-01");
        expect((await get<IncomeEntryPage>("/income/entries")).items[0]?.date).toBe("2026-09-30");
        expect((await get<TransactionPage>("/transactions")).items[0]?.date).toBe("2026-09-30");
      });

      it("Warszawa: 30.09 23:30 UTC to już 1.10", async () => {
        clock.set("2026-09-30T23:30:00Z");

        await complete(typical({ periodStartDay: 1, commitments: [] })).expect(200);

        const [rule] = await get<RecurringRule[]>("/recurring-rules");
        expect(rule?.startDate).toBe("2026-10-01");
      });
    });

    describe("tylko raz", () => {
      it("drugi onboarding to 409 i niczego nie dubluje", async () => {
        await complete(typical({ spentThisPeriod: 45_000 })).expect(200);

        await complete(typical({ periodStartDay: 1, spentThisPeriod: 45_000 })).expect(409);

        expect(await get<PublicUser>("/users/me")).toMatchObject({ periodStartDay: 10 });
        expect((await get<TransactionPage>("/transactions")).items).toHaveLength(1);
        expect(await get<IncomeSource[]>("/income/sources")).toHaveLength(1);
        expect(await get<RecurringRule[]>("/recurring-rules")).toHaveLength(3);
      });

      it("dwa równoczesne żądania (np. ponowienie po zerwanym połączeniu): jedno wygrywa", async () => {
        const statuses = await Promise.all([complete(typical()), complete(typical())]).then(
          (responses) => responses.map((res) => res.status).sort(),
        );

        expect(statuses).toEqual([200, 409]);
        expect(await get<IncomeSource[]>("/income/sources")).toHaveLength(1);
        expect(await get<RecurringRule[]>("/recurring-rules")).toHaveLength(3);
      });
    });

    describe("wszystko albo nic", () => {
      async function expectNothingSaved() {
        expect(await get<PublicUser>("/users/me")).toMatchObject({
          periodStartDay: 1,
          timezone: "Europe/Warsaw",
          onboardingCompleted: false,
        });
        expect(await get<IncomeSource[]>("/income/sources")).toEqual([]);
        expect(await get<RecurringRule[]>("/recurring-rules")).toEqual([]);
        expect((await get<TransactionPage>("/transactions")).items).toEqual([]);
      }

      it("nieznana kategoria zobowiązania: 400 i nic nie zapisane", async () => {
        const res = await complete(
          typical({
            spentThisPeriod: 45_000,
            commitments: [
              { name: "Czynsz", amount: 250_000, dayOfMonth: 5, categoryId: billsId },
              {
                name: "Siłownia",
                amount: 12_000,
                dayOfMonth: 1,
                categoryId: "01923b6e-0000-7000-8000-00000000dead",
              },
            ],
          }),
        ).expect(400);

        expect((res.body as ValidationErrorBody).errors).toEqual([
          { code: "unknown_reference", path: ["categoryId"], message: "unknown_reference" },
        ]);
        await expectNothingSaved();
      });

      it("cudza kategoria wygląda jak nieistniejąca", async () => {
        const other = await registerUser(app);
        const foreign = await db.category.create({
          data: { userId: other.user.id, name: "Konie", icon: "star", color: "#123456" },
        });

        await complete(
          typical({
            commitments: [
              { name: "Stajnia", amount: 90_000, dayOfMonth: 1, categoryId: foreign.id },
            ],
          }),
        ).expect(400);

        await expectNothingSaved();
      });

      it("własna kategoria jest dozwolona", async () => {
        const own = await db.category.create({
          data: { userId: me.user.id, name: "Zwierzęta", icon: "star", color: "#123456" },
        });

        await complete(
          typical({
            commitments: [{ name: "Karma", amount: 15_000, dayOfMonth: 1, categoryId: own.id }],
          }),
        ).expect(200);
      });

      it("niepoprawne dane: 400 walidacji i nic nie zapisane", async () => {
        const res = await complete(typical({ periodStartDay: 29, spentThisPeriod: 45_000 })).expect(
          400,
        );

        expect((res.body as ValidationErrorBody).errors).toEqual([
          expect.objectContaining({ path: ["periodStartDay"] }),
        ]);
        await expectNothingSaved();
      });
    });

    it("onboarding jednego użytkownika nie rusza drugiego", async () => {
      const other = await registerUser(app);

      await complete(typical({ spentThisPeriod: 45_000 })).expect(200);

      expect((await get<TransactionPage>("/transactions", other)).items).toEqual([]);
      expect(await get<PublicUser>("/users/me", other)).toMatchObject({
        periodStartDay: 1,
        onboardingCompleted: false,
      });
      expect(await get<IncomeSource[]>("/income/sources", other)).toEqual([]);
    });

    it("wymaga zalogowania", async () => {
      await http().post("/users/me/onboarding").send(typical()).expect(401);
    });
  });
});
