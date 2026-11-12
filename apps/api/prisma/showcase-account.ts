import {
  addDays,
  budgetPeriodAt,
  currentBudgetPeriod,
  occurrencesInPeriod,
  todayInTimeZone,
  type IsoDate,
} from "@vireo/shared";
import * as argon2 from "argon2";

import { fromIsoDate } from "../src/common/dates.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const TIME_ZONE = "Europe/Warsaw";
const PAYDAY = 10;

const CATEGORY = {
  food: "00000000-0000-7000-8000-000000000001",
  transport: "00000000-0000-7000-8000-000000000002",
  home: "00000000-0000-7000-8000-000000000003",
  fun: "00000000-0000-7000-8000-000000000004",
  health: "00000000-0000-7000-8000-000000000005",
  subscriptions: "00000000-0000-7000-8000-000000000007",
} as const;

/** Stałe płatności: nazwa, kwota, dzień miesiąca, kategoria, czy subskrypcja. */
const COMMITMENTS = [
  { name: "Czynsz", amount: 180_000, day: 10, categoryId: CATEGORY.home, subscription: false },
  { name: "Internet", amount: 6_000, day: 15, categoryId: CATEGORY.home, subscription: false },
  {
    name: "Spotify",
    amount: 2_399,
    day: 5,
    categoryId: CATEGORY.subscriptions,
    subscription: true,
  },
  {
    name: "Netflix",
    amount: 4_300,
    day: 20,
    categoryId: CATEGORY.subscriptions,
    subscription: true,
  },
] as const;

/** Wydatki okresu: dzień od wypłaty, kwota, kategoria, notatka. */
const EXPENSES = [
  { day: 0, amount: 18_734, categoryId: CATEGORY.food, note: "Zakupy w Biedronce" },
  { day: 1, amount: 1_400, categoryId: CATEGORY.food, note: "Kawa" },
  { day: 2, amount: 22_000, categoryId: CATEGORY.transport, note: "Paliwo" },
  { day: 3, amount: 4_600, categoryId: CATEGORY.fun, note: "Kino" },
  { day: 4, amount: 12_450, categoryId: CATEGORY.food, note: "Lidl" },
  { day: 6, amount: 3_899, categoryId: CATEGORY.health, note: "Apteka" },
  { day: 8, amount: 2_890, categoryId: CATEGORY.transport, note: "Uber" },
  { day: 11, amount: 15_620, categoryId: CATEGORY.food, note: "Zakupy na weekend" },
  { day: 14, amount: 8_900, categoryId: CATEGORY.fun, note: "Koncert" },
  { day: 18, amount: 1_400, categoryId: CATEGORY.food, note: "Kawa" },
  { day: 22, amount: 21_300, categoryId: CATEGORY.transport, note: "Paliwo" },
] as const;

/** Ostatni dzień miesiąca `monthsAhead` miesięcy po miesiącu `date`. */
function endOfMonthAhead(date: IsoDate, monthsAhead: number): IsoDate {
  const [year = 0, month = 1] = date.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1 + monthsAhead + 1, 0));
  return end.toISOString().slice(0, 10) as IsoDate;
}

/**
 * Konto do zrzutów ekranu w sklepach i dla recenzentów Apple/Google: po
 * onboardingu, z wypłatą 6500 zł 10. dnia, stałymi płatnościami (w tym
 * dwiema subskrypcjami), dwoma celami z wpłatami i wydatkami bieżącego
 * okresu do dziś. Daty od `now`, więc konto pasuje do każdego dnia okresu.
 * Istniejącego konta nie rusza, chyba że `reset` — wtedy zakłada je od nowa.
 */
export async function ensureShowcaseAccount(
  db: PrismaClient,
  options: { email: string; password: string; now: Date; reset?: boolean },
): Promise<"created" | "exists"> {
  const existing = await db.user.findUnique({ where: { email: options.email } });
  if (existing && !options.reset) return "exists";

  const today = todayInTimeZone(options.now, TIME_ZONE);
  const period = currentBudgetPeriod(today, PAYDAY);
  const previous = budgetPeriodAt(today, PAYDAY, -1);
  const before = budgetPeriodAt(today, PAYDAY, -2);
  const upToToday = { start: period.start, end: today };
  const date = (value: IsoDate) => fromIsoDate(value);

  await db.$transaction(async (tx) => {
    if (existing) await tx.user.delete({ where: { id: existing.id } });
    const startedAt = date(before.start);
    const user = await tx.user.create({
      data: {
        email: options.email,
        passwordHash: await argon2.hash(options.password, { type: argon2.argon2id }),
        periodStartDay: PAYDAY,
        onboardingCompletedAt: startedAt,
        emailVerifiedAt: startedAt,
        createdAt: startedAt,
      },
    });
    const userId = user.id;

    // Wypłata: harmonogram od roku, tegoroczna już wpłynęła (potwierdzona).
    const salaryRule = await tx.recurringRule.create({
      data: {
        userId,
        kind: "INCOME",
        frequency: "MONTHLY",
        interval: 1,
        startDate: date(addDays(before.start, -365)),
        dayOfMonth: PAYDAY,
        createdAt: startedAt,
      },
    });
    const salary = await tx.incomeSource.create({
      data: {
        userId,
        name: "Wypłata",
        kind: "REGULAR",
        expectedAmount: 650_000,
        recurringRuleId: salaryRule.id,
        createdAt: startedAt,
      },
    });
    // Wypłaty z trzech okresów potwierdzone — nic nie wisi jako zaległe.
    await tx.incomeEntry.createMany({
      data: [before.start, previous.start, period.start].map((payday) => ({
        userId,
        incomeSourceId: salary.id,
        amount: 650_000,
        date: date(payday),
        occurrenceDate: date(payday),
        status: "CONFIRMED" as const,
      })),
    });

    // Stałe płatności: terminy do dziś zapłacone, kolejne czekają w budżecie.
    for (const item of COMMITMENTS) {
      const schedule = {
        frequency: "MONTHLY" as const,
        interval: 1,
        startDate: before.start,
        dayOfMonth: item.day,
        dayOfWeek: null,
      };
      const rule = await tx.recurringRule.create({
        data: {
          userId,
          kind: "EXPENSE",
          name: item.name,
          frequency: "MONTHLY",
          interval: 1,
          startDate: date(before.start),
          dayOfMonth: item.day,
          expectedAmount: item.amount,
          categoryId: item.categoryId,
          isSubscription: item.subscription,
          subscriptionUsedOn: item.subscription ? date(previous.start) : null,
          createdAt: startedAt,
        },
      });
      const paid = [before, previous, upToToday].flatMap((range) =>
        occurrencesInPeriod(schedule, range),
      );
      await tx.transaction.createMany({
        data: paid.map((due) => ({
          userId,
          amount: item.amount,
          date: date(due),
          occurrenceDate: date(due),
          categoryId: item.categoryId,
          recurringRuleId: rule.id,
          note: item.name,
          status: "CONFIRMED" as const,
        })),
      });
    }

    // Wydatki bieżącego okresu do dziś — przyszłych dni nie wymyślamy. Dziś
    // tylko drobne: duży zakup akurat dziś zjadłby „Dziś możesz wydać” na zrzucie.
    await tx.transaction.createMany({
      data: EXPENSES.map((item) => ({ ...item, when: addDays(period.start, item.day) }))
        .filter((item) => item.when < today || (item.when === today && item.amount <= 1_500))
        .map((item) => ({
          userId,
          amount: item.amount,
          date: date(item.when),
          categoryId: item.categoryId,
          note: item.note,
          status: "CONFIRMED" as const,
        })),
    });

    // Cele: wpłaty z dwóch poprzednich okresów i — jeśli to nie pierwszy dzień — z tego.
    const trip = await tx.goal.create({
      data: {
        userId,
        name: "Wakacje w Grecji",
        targetAmount: 600_000,
        baseAmount: 150_000,
        targetDate: date(endOfMonthAhead(today, 7)),
      },
    });
    const depositDays = [addDays(before.start, 1), addDays(previous.start, 1)];
    if (addDays(period.start, 1) <= today) depositDays.push(addDays(period.start, 1));
    await tx.goalDeposit.createMany({
      data: depositDays.map((day) => ({
        userId,
        goalId: trip.id,
        amount: 40_000,
        date: date(day),
      })),
    });
    await tx.goal.create({
      data: {
        userId,
        name: "Poduszka finansowa",
        targetAmount: 1_500_000,
        baseAmount: 420_000,
        targetDate: date(endOfMonthAhead(today, 24)),
      },
    });

    await tx.expenseTemplate.create({
      data: { userId, name: "Kawa", amount: 1_400, categoryId: CATEGORY.food },
    });
    await tx.categoryLimit.create({
      data: { userId, categoryId: CATEGORY.food, amount: 120_000 },
    });
  });
  return "created";
}
