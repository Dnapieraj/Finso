# CLAUDE.md — Finso

Ten plik czytasz automatycznie przy każdej sesji. Trzymaj się go.
**Edytuj TYLKO plik wewnątrz repozytorium (finso/CLAUDE.md).** Nie twórz
ani nie edytuj kopii poza repo — to już raz spowodowało rozjazd.

## Projekt

**Finso** — menadżer finansów osobistych. Marka parasolowa: **Vireo**.

**Pozycjonowanie:** Finso odpowiada na pytanie „czy stać mnie na to TERAZ",
zanim użytkownik wyda pieniądze. Nie raportuje przeszłości jak inne appki.

**Wyróżniki:**
1. Symulator decyzji — planowany wydatek → ile zostanie, wpływ na cele
2. Nieregularne dochody — budżet z prognozy i zmienności
3. Detektor subskrypcji — powtarzające się płatności, podwyżki, martwe subskrypcje
4. Wspólne wydatki — należności od znajomych widoczne w budżecie

Pełna specyfikacja: `docs/PRODUCT.md`
Jeśli PRODUCT.md i CLAUDE.md się różnią — **CLAUDE.md wygrywa** (jest aktualniejszy).

## PODZIAŁ RÓL — kluczowa zasada architektury (zmiana z 23.09.2026)

Pierwotnie web miał być pełną aplikacją (dashboard, logowanie przez BFF,
Stripe), a mobile jej portem. 23.09.2026 kierunek odwrócono: cała
aplikacja powstaje w mobile, web został wizytówką, a BFF i Stripe
wycofano (commity `7810a8e`, `1717378`, `70e6981`).

**`apps/mobile` to CAŁA aplikacja.** Logowanie, rejestracja, Dashboard,
symulator „czy mnie stać", dodawanie wydatków, cele, historia, ustawienia,
usuwanie konta, subskrypcje (RevenueCat) — wszystko tu.

**`apps/web` to WYŁĄCZNIE strona marketingowa/wizytówkowa.** Statyczna,
bez logowania, bez backendu logiki biznesowej. Zawiera:
- Stronę główną: hero, wyróżniki produktu, jak appka działa
- Cennik (Free / Plus) z przyciskiem do sklepów — **żadnych płatności na webie**
- Przyciski „Pobierz z App Store" / „Pobierz z Google Play"
- Politykę prywatności i regulamin
- Statyczną instrukcję usuwania konta + e-mail kontaktowy
  (wymóg Google Play — konto realnie usuwa się w appce mobilnej
  przez DELETE /users/me, strona tylko to opisuje)

**Nie dodawaj do web:** logowania, Dashboardu, żadnego stanu użytkownika,
Stripe, TanStack Query do prywatnych danych. Jeśli coś z tego się pojawia
w planie dla web — to błąd, zatrzymaj się i zapytaj.

## Kontekst o mnie

Frontend developer uczący się full-stacku. Buduj **krok po kroku**
i **wyjaśniaj decyzje architektoniczne**.

## Podjęte decyzje

| Decyzja | Wybór |
|---|---|
| Scope pakietów wewnętrznych | `@vireo/*` |
| Commity | Osobny commit na każdy logiczny krok, Conventional Commits |
| Next.js (web) | 16 |
| Prymitywy shadcn/ui | Base UI |
| Expo (mobile) | SDK 57 |
| Prisma | 7, klient generowany do własnego katalogu, driver adapter Postgres |
| NestJS | 11 |
| Auth | Własna implementacja: argon2 + JWT (access + refresh z rotacją) |
| Transport tokenów | JSON body; mobile: expo-secure-store. **Web nie obsługuje sesji użytkownika**, więc httpOnly cookie przez Next.js BFF jest NIEUŻYWANE po zmianie kierunku — usuń, jeśli zostało zaimplementowane |
| Okres budżetowy | `User.periodStartDay` (dzień od wypłaty), nie kalendarzowy miesiąc |
| Dochód/zobowiązania w budżecie | Liczone per wystąpienie (potwierdzone + oczekiwane × (wystąpienia − potwierdzone)) |
| RecurringRule.label | Wymagane dla reguł wydatków, opcjonalne dla reguł dochodu |
| Limity planu FREE | Zapisane, ale egzekwowane dopiero w etapie płatności |
| Kierunek wizualny | **A · Oliwka** — zieleń mchu (od ptaka vireo) |
| Fonty | **Bricolage Grotesque** (nagłówki, `--font-display`) + **Hanken Grotesk** (tekst i kwoty, `--font-body`), oba z `latin-ext` dla polskich znaków |
| Kolory design systemu | Hex, nie oklch (kompatybilność z React Native) |
| Tokeny designu | W `@vireo/ui`: źródło prawdy w `src/tokens/` (współdzielone z mobile), `theme.css` generowany z nich (`generate:theme`), nie edytowany ręcznie |
| Dark mode | Systemowy domyślnie (`prefers-color-scheme`) + klasa `.dark`/`.light` pod przyszły przełącznik |
| Formatowanie kwot | `formatMoney` w `@vireo/shared/format/`, oddzielone od `budget/` (ESLint blokuje import) |
| Płatności | Wyłącznie RevenueCat w mobile (Apple IAP + Google Play Billing). Stripe/web USUNIĘTE z planu |
| Kwoty | Int w groszach |

## Stack

```
finso/
├── apps/
│   ├── api/          NestJS 11 + Prisma 7 + PostgreSQL — wspólne dla web i mobile
│   ├── web/           Next.js 16 — WYŁĄCZNIE strona statyczna/marketingowa
│   └── mobile/        Expo SDK 57 + Expo Router + NativeWind — CAŁA appka
├── packages/
│   ├── shared/        @vireo/shared — typy, Zod, silnik budżetu (budget/), formatMoney (format/)
│   ├── ui/             @vireo/ui — design system Vireo (tokeny w hex, komponenty)
│   └── config/         @vireo/config — eslint (w tym react-hooks), tsconfig, prettier
└── turbo.json
```

Stan serwera (mobile): **TanStack Query**
Formularze (mobile): **React Hook Form + Zod**
Testy: **Vitest** (jednostkowe + coverage wymuszony w `pnpm test` dla shared),
**Supertest** (API e2e, wymaga Docker + `pnpm db:up`), **Playwright** (ścieżki w mobile/web)
Płatności: **RevenueCat** (wyłącznie mobile)

**Zanim zainstalujesz bibliotekę — sprawdź aktualną wersję i kompatybilność
z resztą stacku.** Zgłoś problem zamiast cichego obejścia.

## Zasady kodu — nienegocjowalne

### Pieniądze
- Int w groszach, nigdy Float
- Formatowanie WYŁĄCZNIE przez `formatMoney` z `@vireo/shared/format/`
- `budget/` nigdy nie importuje `format/` (wymuszone przez ESLint)
- Zaokrąglanie zawsze w stronę bezpieczną dla użytkownika, kierunek jawny
  w wywołaniu (`whole: 'down' | 'up'`)

### Daty
- `@db.Date` dla dat kalendarzowych (transakcje, wpływy, terminy celów) —
  nie `DateTime`, żeby uniknąć przesunięć o dzień przy zmianie stref
- `createdAt`/`updatedAt` jako zwykłe `DateTime` (Postgres `timestamptz`, UTC)
- Logika „dnia" (okres budżetowy, dzienny limit) liczona w strefie
  użytkownika — testy na DST i lata przestępne obowiązkowe

### TypeScript
- Tryb `strict`, zero `any`
- Typy współdzielone w `@vireo/shared`, nie duplikuj

### Logika biznesowa
- Silnik budżetu w `@vireo/shared/budget/` — czysty TypeScript, zero
  importów z NestJS, React, Prisma, `format/`
- Każda funkcja eksportowana ma JSDoc
- `pnpm test` w `@vireo/shared` zawsze pilnuje coverage (nie tylko
  osobna komenda `test:cov`)
- Testy PRZED implementacją dla logiki budżetu i formatowania
- Przypadki brzegowe obowiązkowe: zerowy dochód, ujemne saldo, termin
  celu w przeszłości, pusta historia, rok przestępny, DST, reszta
  z dzielenia groszy

### Usuwanie danych — trzy różne mechanizmy, celowo
- `Transaction`, `Goal`: soft delete (`deletedAt`) — dane finansowe nie znikają
- `IncomeSource`: `isActive: false` (archiwizacja) — jeśli ma powiązane
  wpływy, nie da się usunąć, tylko zarchiwizować
- `RecurringRule`: twarde usunięcie — ale transakcje już z niej powstałe zostają
- Wszystkie zapytania i wyliczenia budżetu MUSZĄ pomijać rekordy usunięte/nieaktywne

### UI (mobile jako główny cel)
- Dark mode od początku
- Mobile-first
- Teksty UI w jednym miejscu (web: `src/messages/pl.ts`), żeby dało się
  później dodać inne języki
- Stany: loading (skeleton), error, empty w każdym widoku
- WCAG AA: tekst 4,5:1, obramowania pól i ramki focusu 3:1
- Interfejs po polsku, kod po angielsku
- Design system Vireo — nie domyślny wygląd shadcn

### Web (strona wizytówkowa) — SEO
- Każda podstrona generowana statycznie (SSG), bez wywołań API w runtime
- Metadane na każdej podstronie: `title`, `description`, Open Graph
  (`og:title`, `og:description`, `og:locale` = `pl_PL`), `lang="pl"`
- `sitemap.xml` (`app/sitemap.ts`) ze wszystkimi podstronami
- `robots.txt` (`app/robots.ts`) wskazujący sitemapę
- Absolutne URL-e z `metadataBase`; do publikacji domena to placeholder
  `https://finso.app`, e-mail kontaktowy `kontakt@finso.app`

### Bezpieczeństwo
- Hasła: argon2
- Rate limiting na `/auth/*`
- Walidacja Zod na granicy API zawsze
- Każde zapytanie filtrowane po `userId` — test e2e, że użytkownik A
  nie widzi/nie edytuje danych użytkownika B
- Sekrety tylko w zmiennych środowiskowych
- `DELETE /users/me` usuwa konto kaskadowo — wywoływane z appki mobilnej,
  strona web tylko opisuje jak to zrobić + e-mail kontaktowy
- **Usuwanie konta w `apps/mobile` (etap 7) MUSI dokładnie odpowiadać ścieżce
  ze strony `/usuwanie-konta`** (`apps/web/src/messages/legal/delete-account.ts`):
  zakładka Ustawienia → „Usuń konto” → potwierdzenie hasłem → konto i wszystkie
  dane usunięte od razu. Zmiana jednej strony wymaga zmiany drugiej w tym samym
  etapie (wymóg Google Play: strona musi opisywać realny proces)

## Jak ze mną pracujesz

1. Pytaj, zanim założysz
2. Jeden etap na raz, potem stop
3. Po etapie: wyjaśnij co i dlaczego
4. Błędne polecenie z mojej strony — powiedz mi to
5. **Testy pokazujesz mi do akceptacji, zanim napiszesz implementację** —
   zawsze, nie tylko przy silniku budżetu (logika, API, web, mobile).
   Implementację zaczynasz dopiero po mojej akceptacji.
   Dotyczy też **zmian schemy Prisma i migracji**: przed zmianą pokazujesz
   testy nowego zachowania i SQL migracji. Gdy zmiana nie wprowadza nowego
   zachowania (np. usunięcie nieużywanej kolumny), pokazujesz SQL i wskazujesz
   istniejące testy, które ją obejmują
6. Przed zamknięciem etapu: `pnpm lint`, `pnpm typecheck`, `pnpm test`
   (dla API dodatkowo `pnpm --filter api test:e2e`, wymaga `pnpm db:up`)

## Czego NIE robić

- Nie dodawaj funkcjonalności appki (logowanie, dane użytkownika, płatności) do `apps/web`
- Nie dodawaj bibliotek spoza stacku bez pytania
- Nie pisz integracji bankowej — Faza 3
- Nie pomijaj testów
- Nigdy nie oznaczaj zadania jako gotowe, jeśli testy nie przechodzą
- Nie pisz komentarzy typu `// increment counter` — komentuj *dlaczego*, nie *co*
- Nie wyłączaj reguł lintera ani `@ts-ignore`, żeby coś przeszło
