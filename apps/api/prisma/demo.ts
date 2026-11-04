import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { DEMO_ACCOUNT, ensureDemoAccount } from "./demo-account.js";

// `pnpm --filter api db:demo` — konto demo na lokalnej bazie (appka, Maestro).
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL nie jest ustawione.");
  if (process.env.NODE_ENV === "production") {
    throw new Error("Konto demo tylko na bazie deweloperskiej.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const result = await ensureDemoAccount(prisma);
    console.log(
      result === "created"
        ? `Konto demo: ${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password}`
        : `Konto demo już jest: ${DEMO_ACCOUNT.email}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
