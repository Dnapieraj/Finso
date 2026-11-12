import type {
  BudgetSummary,
  Goal,
  GoalDeposit,
  PublicUser,
  SubscriptionsOverviewOutput,
  TransactionPage,
} from "@vireo/shared";
import request from "supertest";

import { ensureShowcaseAccount } from "../prisma/showcase-account.js";
import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp } from "./helpers.js";
import { createTestApp, createTestDb, resetDb, TestClock } from "./helpers.js";

/**
 * `pnpm --filter api db:showcase` — konto z realistycznymi danymi do zrzutów
 * ekranu w sklepach i dla recenzentów Apple/Google: wypłata, stałe płatności,
 * subskrypcje, cele z wpłatami, wydatki z bieżącego okresu. Daty liczone od
 * „dziś”, więc konto wygląda dobrze w każdym dniu okresu.
 */
const clock = new TestClock();
const ACCOUNT = { email: "recenzja@finso.app", password: "recenzja-haslo-123" };

describe("Konto do zrzutów i dla recenzentów (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;
  const http = () => request(app.getHttpServer());

  async function signIn() {
    const res = await http().post("/auth/login").send(ACCOUNT).expect(200);
    const body = res.body as { accessToken: string; user: PublicUser };
    const auth = { Authorization: `Bearer ${body.accessToken}` };
    const get = async <T>(path: string) => (await http().get(path).set(auth).expect(200)).body as T;
    return { user: body.user, get };
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
    await db.category.createMany({
      data: [
        { id: "00000000-0000-7000-8000-000000000001", name: "Jedzenie", icon: "x", color: "#000" },
        { id: "00000000-0000-7000-8000-000000000002", name: "Transport", icon: "x", color: "#000" },
        {
          id: "00000000-0000-7000-8000-000000000003",
          name: "Mieszkanie",
          icon: "x",
          color: "#000",
        },
        { id: "00000000-0000-7000-8000-000000000004", name: "Rozrywka", icon: "x", color: "#000" },
        { id: "00000000-0000-7000-8000-000000000005", name: "Zdrowie", icon: "x", color: "#000" },
        {
          id: "00000000-0000-7000-8000-000000000007",
          name: "Subskrypcje",
          icon: "x",
          color: "#000",
        },
      ],
    });
  });

  it.each(["2026-11-12T10:00:00Z", "2026-11-10T08:00:00Z", "2026-12-09T20:00:00Z"])(
    "dzień %s: konto gotowe, budżet na plusie, wszystko do pokazania",
    async (now) => {
      clock.set(now);
      expect(await ensureShowcaseAccount(db, { ...ACCOUNT, now: new Date(now) })).toBe("created");

      const { user, get } = await signIn();
      expect(user).toMatchObject({
        onboardingCompleted: true,
        emailVerified: true,
        periodStartDay: 10,
      });

      const budget = await get<BudgetSummary>("/budget/current");
      expect(budget.availableBalance).toBeGreaterThan(0);
      expect(budget.dailyAllowance).toBeGreaterThan(0);
      expect(budget.breakdown.periodIncome).toBe(650_000);
      expect(budget.awaitingIncome).toBe(0);
      // Nic zaległego do potwierdzenia: wcześniejsze wypłaty i płatności są zapisane.
      expect(await get<unknown[]>("/confirmations")).toEqual([]);
      // Dzisiejszy limit wygląda jak u kogoś, kto trzyma budżet.
      expect(budget.today.left).toBeGreaterThan(5_000);

      const goals = await get<Goal[]>("/goals");
      expect(goals.map((goal) => goal.name)).toEqual(["Wakacje w Grecji", "Poduszka finansowa"]);
      const [trip] = goals;
      expect(
        trip && (await get<GoalDeposit[]>(`/goals/${trip.id}/deposits`)).length,
      ).toBeGreaterThan(1);

      const subscriptions = await get<SubscriptionsOverviewOutput>("/subscriptions");
      expect(subscriptions.confirmed.map((item) => item.name)).toEqual(
        expect.arrayContaining(["Spotify", "Netflix"]),
      );

      const expenses = await get<TransactionPage>("/transactions?status=CONFIRMED");
      expect(expenses.items.length).toBeGreaterThan(0);
    },
  );

  it("drugie uruchomienie niczego nie dubluje ani nie nadpisuje", async () => {
    clock.set("2026-11-12T10:00:00Z");
    const now = new Date("2026-11-12T10:00:00Z");
    await ensureShowcaseAccount(db, { ...ACCOUNT, now });

    expect(await ensureShowcaseAccount(db, { ...ACCOUNT, now })).toBe("exists");
    expect(await db.user.count({ where: { email: ACCOUNT.email } })).toBe(1);
  });

  it("z `reset` zakłada konto od nowa — daty znów pasują do dziś", async () => {
    clock.set("2026-11-12T10:00:00Z");
    await ensureShowcaseAccount(db, { ...ACCOUNT, now: new Date("2026-10-12T10:00:00Z") });

    expect(
      await ensureShowcaseAccount(db, {
        ...ACCOUNT,
        now: new Date("2026-11-12T10:00:00Z"),
        reset: true,
      }),
    ).toBe("created");

    const { get } = await signIn();
    expect((await get<BudgetSummary>("/budget/current")).breakdown.periodIncome).toBe(650_000);
  });
});
