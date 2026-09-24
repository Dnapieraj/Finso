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
| `apps/mobile` | **Cała aplikacja** (iOS + Android): logowanie, dashboard, symulator, wydatki, cele, subskrypcje przez RevenueCat. _Etap 7 w toku: szkielet i ekran startowy._                 |
| `apps/web`    | **Wyłącznie statyczna strona wizytówkowa**: opis produktu, cennik, linki do sklepów, polityka prywatności, regulamin, usuwanie konta. Bez logowania i bez danych użytkownika. |
| `apps/api`    | Backend dla aplikacji mobilnej: auth, CRUD, silnik budżetu przez `/budget`.                                                                                                   |

## Stack

```
finso/
├── apps/
│   ├── api/       NestJS 11 + Prisma 7 + PostgreSQL 18
│   ├── web/       Next.js 16 (App Router, SSG) + Tailwind v4 — strona wizytówkowa
│   └── mobile/    Expo SDK 57 + Expo Router + NativeWind 4 — cała aplikacja (etap 7 w toku)
└── packages/
    ├── shared/    @vireo/shared — typy, schematy Zod, silnik budżetu, formatMoney, klient API
    ├── tokens/    @vireo/tokens — tokeny designu Vireo (kolory hex), wspólne dla web i mobile
    ├── ui/        @vireo/ui — webowy design system Vireo (theme.css, komponenty)
    └── config/    @vireo/config — ESLint, tsconfig, Prettier
```

Monorepo: **Turborepo + pnpm workspaces**. Testy: **Vitest**, **Jest** (`jest-expo`, mobile),
**Supertest** (API e2e), **Playwright** (web e2e). CI: GitHub Actions.

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

# 5. Build pakietów współdzielonych (API, web i mobile importują @vireo/shared z dist/)
pnpm build --filter=@vireo/shared

# 6. Start
pnpm --filter api start:dev    # API:  http://localhost:3000, dokumentacja: /docs
pnpm --filter web dev          # web:  http://localhost:3000 (albo kolejny wolny port)
pnpm --filter mobile start     # mobile: kod QR dla Expo Go — najpierw ustaw apps/mobile/.env
```

Aplikacja mobilna na telefonie łączy się z API po **adresie IP komputera w sieci Wi-Fi**,
nie po `localhost` — szczegóły w [`apps/mobile/README.md`](apps/mobile/README.md).

Bazę zatrzymasz przez `pnpm db:down` (dane zostają w wolumenie Dockera).

## Komendy

| Komenda                      | Co robi                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm lint`                  | ESLint we wszystkich pakietach                                                                        |
| `pnpm typecheck`             | TypeScript (`strict`) we wszystkich pakietach                                                         |
| `pnpm test`                  | Testy jednostkowe; w `@vireo/shared` i `@vireo/tokens` z wymuszonym 100% coverage; mobile przez Jest  |
| `pnpm --filter api test:e2e` | Testy e2e API na prawdziwym Postgresie — wymaga `pnpm db:up`; same tworzą i migrują bazę `finso_test` |
| `pnpm --filter web test:e2e` | Playwright na produkcyjnym buildzie strony (desktop + telefon)                                        |
| `pnpm format`                | Prettier dla całego repo                                                                              |

CI uruchamia lint, typecheck, testy i Playwright przy każdym pushu
(`.github/workflows/ci.yml`). CI nie ma pliku `.env` — potrzebne zmienne są ustawione w workflow.

## Dokumentacja

- [`CLAUDE.md`](CLAUDE.md) — zasady pracy i decyzje architektoniczne (źródło prawdy przy rozbieżnościach)
- [`docs/PRODUCT.md`](docs/PRODUCT.md) — specyfikacja produktu, fazy, kolejność etapów, lista zadań przed publikacją
- [`apps/api/README.md`](apps/api/README.md), [`apps/web/README.md`](apps/web/README.md), [`apps/mobile/README.md`](apps/mobile/README.md) — szczegóły aplikacji
