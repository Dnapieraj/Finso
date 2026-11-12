import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { ensureShowcaseAccount } from "./showcase-account.js";

/**
 * `pnpm --filter api db:showcase [--reset]` — konto z realistycznymi danymi
 * do zrzutów ekranu i dla recenzentów sklepów (docs/PUBLIKACJA.md).
 * Na produkcji hasło musi przyjść w SHOWCASE_PASSWORD — nigdy z kodu.
 * `--reset` zakłada konto od nowa, z datami od dziś.
 */
const LOCAL_PASSWORD = "recenzja-haslo-123";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL nie jest ustawione.");
  const email = process.env.SHOWCASE_EMAIL ?? "recenzja@finso.app";
  const password = process.env.SHOWCASE_PASSWORD ?? LOCAL_PASSWORD;
  if (process.env.NODE_ENV === "production" && password === LOCAL_PASSWORD) {
    throw new Error("Na produkcji ustaw SHOWCASE_PASSWORD (min. 12 znaków).");
  }
  if (password.length < 12) throw new Error("SHOWCASE_PASSWORD musi mieć co najmniej 12 znaków.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const result = await ensureShowcaseAccount(prisma, {
      email,
      password,
      now: new Date(),
      reset: process.argv.includes("--reset"),
    });
    console.log(
      result === "created"
        ? `Konto pokazowe gotowe: ${email}`
        : `Konto pokazowe już jest: ${email} (od nowa: --reset)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
