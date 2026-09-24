# api

Backend Finso: **NestJS 11 + Prisma 7 + PostgreSQL 18**. Obsługuje aplikację mobilną
(`apps/mobile`); strona `apps/web` z API nie korzysta.

- Auth: e-mail + hasło (argon2), JWT access + refresh z rotacją i wykrywaniem ponownego użycia
- CRUD: transakcje, cele, kategorie, reguły cykliczne, źródła i wpływy dochodu
- Budżet: `GET /budget/current`, `POST /budget/simulate` (silnik z `@vireo/shared`)
- Konto: `GET /users/me`, `DELETE /users/me` (usuwa konto kaskadowo, wymaga hasła)
- Walidacja wejścia schematami Zod, rate limiting na `/auth/*`
- Dokumentacja OpenAPI: **http://localhost:3000/docs**

## Prisma

Schema: `prisma/schema.prisma`, konfiguracja: `prisma.config.ts` (czyta `DATABASE_URL` z `.env`).
Klient generuje się do `src/generated/prisma` przy `pnpm install` i używa driver adaptera Postgres.

```bash
pnpm --filter api db:migrate:dev --name opis_zmiany      # nowa migracja (dev)
pnpm --filter api db:migrate:deploy                      # zastosowanie istniejących migracji
pnpm --filter api db:seed                                # kategorie systemowe
pnpm --filter api db:studio                              # podgląd danych w przeglądarce
```

## Uruchomienie

Wymaga `.env` (skopiuj z `.env.example`), bazy z `pnpm db:up` (w katalogu głównym)
i zbudowanego `@vireo/shared` — pełna instrukcja w [README głównym](../../README.md).

```bash
pnpm --filter api start:dev
```

## Testy

```bash
pnpm --filter api test       # jednostkowe (Vitest)
pnpm --filter api test:e2e   # e2e (Vitest + Supertest) na bazie finso_test
```

Testy e2e wymagają działającego Postgresa (`pnpm db:up`); bazę `finso_test` tworzą i migrują same.
Obejmują m.in. izolację danych między użytkownikami — użytkownik A nie widzi ani nie edytuje danych B.
