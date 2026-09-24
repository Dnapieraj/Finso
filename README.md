# Finso

Menadżer finansów osobistych, który odpowiada na pytanie **„czy stać mnie na to teraz?”** —
zanim wydasz pieniądze, a nie po fakcie. Pierwszy produkt marki **Vireo**.

- **Symulator decyzji** — planowany wydatek → ile zostanie do wypłaty, ile dziennie, wpływ na cele
- **Nieregularne dochody** — budżet z ostrożnej prognozy, nie ze stałej pensji
- **Detektor subskrypcji** — powtarzające się płatności, podwyżki, martwe subskrypcje
- **Wspólne wydatki** — należności od znajomych widoczne w budżecie

## Podział ról

| Część         | Co to jest                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile` | **Cała aplikacja** (iOS + Android): logowanie, dashboard, symulator, wydatki, cele, subskrypcje przez RevenueCat. _W przygotowaniu (etap 7)._                                 |
| `apps/web`    | **Wyłącznie statyczna strona wizytówkowa**: opis produktu, cennik, linki do sklepów, polityka prywatności, regulamin, usuwanie konta. Bez logowania i bez danych użytkownika. |
| `apps/api`    | Backend dla aplikacji mobilnej: auth, CRUD, silnik budżetu przez `/budget`.                                                                                                   |

## Stack

```
finso/
├── apps/
│   ├── api/       NestJS 11 + Prisma 7 + PostgreSQL 18
│   ├── web/       Next.js 16 (App Router, SSG) + Tailwind v4 — strona wizytówkowa
│   └── mobile/    Expo SDK 57 + Expo Router + NativeWind — cała aplikacja (wkrótce)
└── packages/
    ├── shared/    @vireo/shared — typy, schematy Zod, silnik budżetu, formatMoney
    ├── ui/        @vireo/ui — design system Vireo (tokeny, motyw, komponenty)
    └── config/    @vireo/config — ESLint, tsconfig, Prettier
```

Monorepo: **Turborepo + pnpm workspaces**. Testy: **Vitest**, **Supertest** (API e2e),
**Playwright** (web e2e). CI: GitHub Actions.

## Uruchomienie od zera

Wymagania: **Node.js ≥ 20.9**, **pnpm 11** (`corepack enable` wystarczy), **Docker**.

```bash
# 1. Zależności
pnpm install

# 2. Zmienne środowiskowe API
cp apps/api/.env.example apps/api/.env
#    uzupełnij JWT_ACCESS_SECRET (min. 32 znaki), np.:
#    node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. Baza danych (Postgres w Dockerze)
pnpm db:up

# 4. Migracje i kategorie systemowe
pnpm --filter api db:migrate:deploy
pnpm --filter api db:seed

# 5. Build pakietów współdzielonych (API i web importują @vireo/shared z dist/)
pnpm build --filter=@vireo/shared

# 6. Start
pnpm --filter api start:dev    # API:  http://localhost:3000, dokumentacja: /docs
pnpm --filter web dev          # web:  http://localhost:3000 (albo kolejny wolny port)
```

Bazę zatrzymasz przez `pnpm db:down` (dane zostają w wolumenie Dockera).

## Komendy

| Komenda                      | Co robi                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm lint`                  | ESLint we wszystkich pakietach                                                                        |
| `pnpm typecheck`             | TypeScript (`strict`) we wszystkich pakietach                                                         |
| `pnpm test`                  | Testy jednostkowe; w `@vireo/shared` i `@vireo/ui` z wymuszonym coverage                              |
| `pnpm --filter api test:e2e` | Testy e2e API na prawdziwym Postgresie — wymaga `pnpm db:up`; same tworzą i migrują bazę `finso_test` |
| `pnpm --filter web test:e2e` | Playwright na produkcyjnym buildzie strony (desktop + telefon)                                        |
| `pnpm format`                | Prettier dla całego repo                                                                              |

CI uruchamia lint, typecheck, testy i Playwright przy każdym pushu
(`.github/workflows/ci.yml`). CI nie ma pliku `.env` — potrzebne zmienne są ustawione w workflow.

## Dokumentacja

- [`CLAUDE.md`](CLAUDE.md) — zasady pracy i decyzje architektoniczne (źródło prawdy przy rozbieżnościach)
- [`docs/PRODUCT.md`](docs/PRODUCT.md) — specyfikacja produktu, fazy, kolejność etapów, lista zadań przed publikacją
- [`apps/api/README.md`](apps/api/README.md), [`apps/web/README.md`](apps/web/README.md) — szczegóły aplikacji
