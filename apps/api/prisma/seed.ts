import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Kategorie systemowe: userId = null, więc widoczne dla każdego
 * użytkownika i nie do usunięcia z poziomu appki (Category.userId
 * nullable = systemowa, patrz schema.prisma).
 *
 * Stałe id (zamiast losowego uuid(7) z @default) zamiast polegać na
 * unikalności (name, userId) — Postgres traktuje NULL jako różne od
 * NULL, więc unique([userId, name]) i tak by nie zabezpieczyło przed
 * duplikatami wierszy systemowych. Dzięki stałemu id ten seed można
 * bezpiecznie odpalać wielokrotnie (upsert po id, nie tworzy kopii).
 *
 * `icon` to nazwa ikony Lucide (apps/web ma iconLibrary: "lucide" w
 * components.json) — świadome sprzężenie z tym, czym renderuje web.
 */
const SYSTEM_CATEGORIES = [
  { id: 'cat-jedzenie', name: 'Jedzenie', icon: 'utensils', color: '#F59E0B' },
  { id: 'cat-transport', name: 'Transport', icon: 'car', color: '#3B82F6' },
  { id: 'cat-mieszkanie', name: 'Mieszkanie', icon: 'home', color: '#8B5CF6' },
  {
    id: 'cat-rozrywka',
    name: 'Rozrywka',
    icon: 'party-popper',
    color: '#EC4899',
  },
  {
    id: 'cat-zdrowie',
    name: 'Zdrowie',
    icon: 'heart-pulse',
    color: '#EF4444',
  },
  {
    id: 'cat-edukacja',
    name: 'Edukacja',
    icon: 'graduation-cap',
    color: '#10B981',
  },
  {
    id: 'cat-subskrypcje',
    name: 'Subskrypcje',
    icon: 'repeat',
    color: '#6366F1',
  },
  { id: 'cat-inne', name: 'Inne', icon: 'more-horizontal', color: '#6B7280' },
] as const;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL nie jest ustawione.');
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    for (const category of SYSTEM_CATEGORIES) {
      await prisma.category.upsert({
        where: { id: category.id },
        update: {
          name: category.name,
          icon: category.icon,
          color: category.color,
        },
        create: { ...category, userId: null },
      });
    }

    console.log(
      `Seed: ${SYSTEM_CATEGORIES.length} kategorii systemowych gotowych.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
