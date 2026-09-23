# CLAUDE.md — Finso

Ten plik czytasz automatycznie przy każdej sesji. Trzymaj się go.

## Projekt

**Finso** — menadżer finansów osobistych (web + iOS + Android).
Marka parasolowa: **Vireo** (w przyszłości kolejne produkty w tym samym monorepo).

**Pozycjonowanie:** Finso odpowiada na pytanie „czy stać mnie na to TERAZ",
zanim użytkownik wyda pieniądze. Nie raportuje przeszłości jak inne appki.

**Wyróżniki:**
1. Symulator decyzji — planowany wydatek → ile zostanie, wpływ na cele
2. Nieregularne dochody — budżet z prognozy i zmienności, nie ze stałej pensji
3. Detektor subskrypcji — powtarzające się płatności, podwyżki, martwe subskrypcje
4. Wspólne wydatki — należności od znajomych widoczne w budżecie

Pełna specyfikacja: `docs/PRODUCT.md`
Jeśli PRODUCT.md i CLAUDE.md się różnią — **CLAUDE.md wygrywa** (jest aktualniejszy).

## Kontekst o mnie

Jestem frontend developerem uczącym się full-stacku. Buduj **krok po kroku**
i **wyjaśniaj decyzje architektoniczne**. Chcę rozumieć kod, nie tylko go mieć.

## Podjęte decyzje (nie pytaj o nie ponownie)

| Decyzja | Wybór |
|---|---|
| Scope pakietów wewnętrznych | **`@vireo/*`** (np. `@vireo/shared`, `@vireo/ui`, `@vireo/config`) |
| Commity | **Osobny commit na każdy logiczny krok**, Conventional Commits |
| Next.js | **16** (najnowsza stabilna) |
| Prymitywy shadcn/ui | **Base UI** (nie Radix) |
| Expo | **SDK 57** (nie 56 — ma znaną regresję pamięci Hermes) |
| Prisma | **7** — klient generowany do własnego katalogu, driver adapter dla Postgres |
| NestJS | **11** |
| Auth | **Własna implementacja w NestJS**: argon2 + JWT (access + refresh). Nie Lucia (porzucona), nie Auth.js |
| Kwoty | **Int w groszach** |
| Kierunek wizualny | **A · Oliwka** — zieleń mchu (od ptaka vireo), Bricolage Grotesque (display) + Hanken Grotesk (tekst, kwoty) |
| Tokeny designu | **W `@vireo/ui`**, źródło prawdy w `tokens.ts` (współdzielone z mobile) |
| Dark mode | **Systemowy domyślnie** + klasa `.dark`/`.light` pod przyszły przełącznik |

## Stack

```
finso/
├── apps/
│   ├── api/          NestJS 11 + Prisma 7 + PostgreSQL
│   ├── web/          Next.js 16 (App Router) + Tailwind v4 + shadcn/ui (Base UI)
│   └── mobile/       Expo SDK 57 + Expo Router + NativeWind
├── packages/
│   ├── shared/       @vireo/shared — typy, schematy Zod, CZYSTA logika budżetu
│   ├── ui/           @vireo/ui — design system Vireo (tokeny, motyw, komponenty)
│   └── config/       @vireo/config — eslint, tsconfig, prettier
└── turbo.json
```

Monorepo: **Turborepo + pnpm workspaces**
Stan serwera (web i mobile): **TanStack Query**
Formularze: **React Hook Form + Zod**
Testy: **Vitest** (jednostkowe), **Supertest** (API e2e), **Playwright** (web e2e)
Płatności: **RevenueCat** (mobile) + **Stripe** (web)

**Zanim zainstalujesz dowolną bibliotekę — sprawdź jej aktualną wersję
i kompatybilność z resztą stacku.** Jeśli coś jest niekompatybilne
(np. NativeWind z Tailwind v4, jakaś biblioteka z Expo SDK 57) — powiedz mi,
zanim wybierzesz obejście.

## Zasady kodu — nienegocjowalne

### Pieniądze
- Kwoty **zawsze jako liczby całkowite w groszach** (Int), nigdy Float
- Konwersja na format wyświetlania **tylko przez `formatMoney` z `@vireo/shared`**
  (moduł `src/format/`), wywoływaną w warstwie prezentacji (web, mobile).
  Nie używaj `Intl.NumberFormat` do kwot w komponentach — Hermes formatuje
  inaczej niż V8. Silnik (`budget/`) nie importuje `format/` (pilnuje ESLint)
- Pełne złote (`whole`) zawsze z jawnym kierunkiem: `'down'` dla środków
  do wydania, `'up'` dla kosztów
- Przy dzieleniu kwot (np. na dni) — jawna reguła zaokrąglania, zawsze w dół
  na korzyść bezpieczeństwa użytkownika, i test na to

### Daty
- Przechowuj w UTC, prezentuj w strefie użytkownika
- Logika „dnia" (dzień wypłaty, dzienny limit) liczona w strefie użytkownika —
  testy na zmianę czasu letniego/zimowego

### TypeScript
- Tryb `strict` włączony
- **Zero `any`.** Jeśli nie znasz typu, użyj `unknown` i zawęź
- Typy współdzielone mieszkają w `@vireo/shared`, nie duplikuj ich

### Logika biznesowa
- Silnik budżetu w `@vireo/shared` to **czysty TypeScript** —
  zero importów z NestJS, React, Prisma
- Wejście: dane. Wyjście: wyliczenia. Bez efektów ubocznych
- Każda funkcja eksportowana ma JSDoc

### Testy
- **Testy piszesz PRZED implementacją** dla logiki budżetu
- Pokaż mi testy do akceptacji zanim napiszesz kod
- Przypadki brzegowe obowiązkowo: zerowy dochód, ujemne saldo,
  termin celu w przeszłości, pusta historia, rok przestępny, zmiana DST
- Nigdy nie oznaczaj zadania jako gotowe, jeśli testy nie przechodzą

### UI
- Dark mode od początku, nie jako dodatek
- Mobile-first
- Każdy widok ma stany: loading (skeleton), error, empty
- Dostępność: nawigacja klawiaturą, aria-labels, kontrast WCAG AA
- Interfejs po polsku, ale kod (nazwy zmiennych, komentarze) po angielsku.
  Teksty UI trzymaj w jednym miejscu, żeby dało się później dodać inne języki
- Nie zostawiaj domyślnego wyglądu shadcn — design system Vireo

### Bezpieczeństwo
- Hasła: **argon2**
- Rate limiting na endpointach auth
- Walidacja wejścia Zod na granicy API — zawsze
- Każde zapytanie do bazy filtrowane po `userId` zalogowanego użytkownika —
  użytkownik nigdy nie widzi cudzych danych (test e2e na to)
- Sekrety tylko w zmiennych środowiskowych, nigdy w kodzie ani w commitach
- Użytkownik musi móc usunąć konto z danymi (wymóg App Store + RODO)

## Jak ze mną pracujesz

1. **Pytaj, zanim założysz.** Jeśli czegoś nie jesteś pewien — zapytaj
2. **Nie generuj całego projektu naraz.** Jeden etap, potem stop
3. **Po każdym etapie zatrzymaj się** i wyjaśnij co zrobiłeś i dlaczego
4. Jeśli moje polecenie jest błędne technicznie — powiedz mi to
5. Przed zakończeniem etapu uruchom: `pnpm lint`, `pnpm typecheck`, `pnpm test`
   (w `@vireo/shared` `pnpm test` pilnuje też 100% coverage).
   Jeśli etap dotyka API — dodatkowo `pnpm --filter api test:e2e`.
   To osobny krok: wymaga Dockera z Postgresem (`pnpm db:up`), dlatego nie
   wchodzi w `pnpm test`. Testy e2e same tworzą i migrują bazę `finso_test`.

## Czego NIE robić

- Nie dodawaj bibliotek spoza stacku bez zapytania mnie
- Nie pisz integracji bankowej (Open Banking) — to Faza 3
- Nie pomijaj testów, „bo to prosta funkcja"
- Nie wyłączaj reguł lintera ani nie dodawaj `@ts-ignore`, żeby coś przeszło
- Nie pisz komentarzy typu `// increment counter` — komentuj *dlaczego*, nie *co*
