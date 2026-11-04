import * as argon2 from "argon2";

import type { PrismaClient } from "../src/generated/prisma/client.js";

/** Lokalne konto demo — tylko baza deweloperska, nigdy produkcja. */
export const DEMO_ACCOUNT = { email: "demo@finso.app", password: "demo-haslo-123" } as const;

/**
 * Zakłada konto demo, jeśli go nie ma: po onboardingu, z potwierdzonym
 * adresem, wypłatą 6500 zł 10. dnia miesiąca. Istniejącego konta nie
 * rusza — dane wpisane w appce zostają.
 */
export async function ensureDemoAccount(db: PrismaClient): Promise<"created" | "exists"> {
  const existing = await db.user.findUnique({ where: { email: DEMO_ACCOUNT.email } });
  if (existing) return "exists";

  const now = new Date();
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: DEMO_ACCOUNT.email,
        passwordHash: await argon2.hash(DEMO_ACCOUNT.password, { type: argon2.argon2id }),
        periodStartDay: 10,
        onboardingCompletedAt: now,
        emailVerifiedAt: now,
      },
    });
    // Harmonogram od początku zeszłego roku: wypłata liczy się w każdym okresie.
    const rule = await tx.recurringRule.create({
      data: {
        userId: user.id,
        kind: "INCOME",
        frequency: "MONTHLY",
        interval: 1,
        startDate: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 10)),
        dayOfMonth: 10,
      },
    });
    await tx.incomeSource.create({
      data: {
        userId: user.id,
        name: "Wypłata",
        kind: "REGULAR",
        expectedAmount: 650_000,
        recurringRuleId: rule.id,
      },
    });
  });
  return "created";
}
