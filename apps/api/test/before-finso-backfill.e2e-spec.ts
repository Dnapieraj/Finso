import { readFileSync } from "node:fs";
import { join } from "node:path";

import { OTHER_CATEGORY_ID } from "../src/categories/system-category-ids.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TestApp } from "./helpers.js";
import { createTestApp, createTestDb, registerUser, resetDb } from "./helpers.js";

/**
 * The migration marks the onboarding's "Wydatki przed Finso" expense on
 * accounts created before the flag existed. This runs the very UPDATE from
 * migration.sql (between its markers) on data shaped like real accounts.
 */
const MIGRATION = join(
  import.meta.dirname,
  "../prisma/migrations/20261013120000_expense_templates_before_finso/migration.sql",
);

function backfillSql(): string {
  const sql = readFileSync(MIGRATION, "utf8");
  const match = /-- backfill:start\n([\s\S]*?)-- backfill:end/.exec(sql);
  if (!match?.[1]) throw new Error("No backfill markers in the migration");
  return match[1];
}

const NOTE = "Wydatki przed Finso";
const ONBOARDED = new Date("2026-09-23T10:00:00Z");

describe("Migracja: backfill beforeFinso (e2e)", () => {
  let app: TestApp;
  let db: PrismaClient;

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
    await db.category.upsert({
      where: { id: OTHER_CATEGORY_ID },
      create: {
        id: OTHER_CATEGORY_ID,
        userId: null,
        name: "Inne",
        icon: "other",
        color: "#57534e",
      },
      update: {},
    });
  });

  async function onboardedUser(): Promise<string> {
    const session = await registerUser(app);
    await db.user.update({
      where: { id: session.user.id },
      data: { onboardingCompletedAt: ONBOARDED },
    });
    return session.user.id;
  }

  const expense = (userId: string, createdAt: Date, extra: object = {}) =>
    db.transaction.create({
      data: {
        userId,
        amount: 45_000,
        date: new Date("2026-09-23"),
        note: NOTE,
        categoryId: OTHER_CATEGORY_ID,
        createdAt,
        ...extra,
      },
    });

  const flagged = async (userId: string) =>
    (await db.transaction.findMany({ where: { userId, beforeFinso: true } })).map((tx) => tx.id);

  it("oznacza wydatek zapisany przy onboardingu", async () => {
    const user = await onboardedUser();
    const lump = await expense(user, ONBOARDED);

    await db.$executeRawUnsafe(backfillSql());

    expect(await flagged(user)).toEqual([lump.id]);
  });

  it("najwyżej jeden na użytkownika: późniejszy wydatek z tą samą notatką zostaje zwykły", async () => {
    const user = await onboardedUser();
    const lump = await expense(user, ONBOARDED);
    await expense(user, new Date("2026-09-30T18:00:00Z"));

    await db.$executeRawUnsafe(backfillSql());

    expect(await flagged(user)).toEqual([lump.id]);
  });

  it("onboarding bez wydatków (pominięty krok), a potem ręcznie wpisana ta sama notatka: nic", async () => {
    const user = await onboardedUser();
    await expense(user, new Date("2026-09-24T09:00:00Z"));

    await db.$executeRawUnsafe(backfillSql());

    expect(await flagged(user)).toEqual([]);
  });

  it("inna kategoria, stała płatność albo konto bez onboardingu: nic", async () => {
    const user = await onboardedUser();
    const rule = await db.recurringRule.create({
      data: {
        userId: user,
        kind: "EXPENSE",
        name: "Czynsz",
        frequency: "MONTHLY",
        dayOfMonth: 10,
        startDate: new Date("2026-09-10"),
        expectedAmount: 150_000,
      },
    });
    await expense(user, ONBOARDED, { categoryId: null });
    await expense(user, ONBOARDED, { recurringRuleId: rule.id });
    const notOnboarded = (await registerUser(app)).user.id;
    await expense(notOnboarded, ONBOARDED);

    await db.$executeRawUnsafe(backfillSql());

    expect(await flagged(user)).toEqual([]);
    expect(await flagged(notOnboarded)).toEqual([]);
  });

  it("każdy użytkownik osobno", async () => {
    const alice = await onboardedUser();
    const bob = await onboardedUser();
    const alicesLump = await expense(alice, ONBOARDED);
    const bobsLump = await expense(bob, ONBOARDED);

    await db.$executeRawUnsafe(backfillSql());

    expect(await flagged(alice)).toEqual([alicesLump.id]);
    expect(await flagged(bob)).toEqual([bobsLump.id]);
  });
});
