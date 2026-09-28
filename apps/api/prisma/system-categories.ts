import type { PrismaClient } from "../src/generated/prisma/client.js";

/**
 * Kategorie systemowe: userId = null, więc widoczne dla każdego
 * użytkownika i nie do usunięcia z poziomu appki (Category.userId
 * nullable = systemowa, patrz schema.prisma).
 *
 * Stałe id (zamiast losowego uuid(7) z @default) zamiast polegać na
 * unikalności (name, userId) — Postgres traktuje NULL jako różne od
 * NULL, więc unique([userId, name]) i tak by nie zabezpieczyło przed
 * duplikatami wierszy systemowych. Dzięki stałemu id seed można
 * bezpiecznie odpalać wielokrotnie (upsert po id, nie tworzy kopii).
 *
 * Id muszą być UUID — API waliduje nimi każdą odpowiedź (idSchema).
 * Zerowy prefiks czasu odróżnia je od id nadawanych przez bazę.
 * Zmiana id wymaga migracji (patrz *_system_category_uuids).
 *
 * `icon` to nazwa ikony Lucide — świadome sprzężenie z tym, czym
 * renderują web i mobile.
 */
export const SYSTEM_CATEGORIES = [
  {
    id: "00000000-0000-7000-8000-000000000001",
    name: "Jedzenie",
    icon: "utensils",
    color: "#F59E0B",
  },
  { id: "00000000-0000-7000-8000-000000000002", name: "Transport", icon: "car", color: "#3B82F6" },
  {
    id: "00000000-0000-7000-8000-000000000003",
    name: "Mieszkanie",
    icon: "home",
    color: "#8B5CF6",
  },
  {
    id: "00000000-0000-7000-8000-000000000004",
    name: "Rozrywka",
    icon: "party-popper",
    color: "#EC4899",
  },
  {
    id: "00000000-0000-7000-8000-000000000005",
    name: "Zdrowie",
    icon: "heart-pulse",
    color: "#EF4444",
  },
  {
    id: "00000000-0000-7000-8000-000000000006",
    name: "Edukacja",
    icon: "graduation-cap",
    color: "#10B981",
  },
  {
    id: "00000000-0000-7000-8000-000000000007",
    name: "Subskrypcje",
    icon: "repeat",
    color: "#6366F1",
  },
  {
    id: "00000000-0000-7000-8000-000000000008",
    name: "Inne",
    icon: "more-horizontal",
    color: "#6B7280",
  },
] as const;

/** Tworzy albo aktualizuje kategorie systemowe; wywoływane przez `pnpm db:seed` i testy e2e. */
export async function seedSystemCategories(prisma: PrismaClient): Promise<void> {
  for (const category of SYSTEM_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: { name: category.name, icon: category.icon, color: category.color },
      create: { ...category, userId: null },
    });
  }
}
