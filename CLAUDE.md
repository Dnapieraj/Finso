# CLAUDE.md — Finso

Ten plik czytasz automatycznie przy każdej sesji. Trzymaj się go.

## Projekt

**Finso** — menadżer finansów osobistych (web + iOS + Android).
Marka parasolowa: **Vireo**.

**Pozycjonowanie:** Finso odpowiada na pytanie „czy stać mnie na to TERAZ",
zanim użytkownik wyda pieniądze. Nie raportuje przeszłości jak inne appki.

**Wyróżniki:**
1. Symulator decyzji — planowany wydatek → ile zostanie, wpływ na cele
2. Nieregularne dochody — budżet z prognozy i zmienności, nie ze stałej pensji
3. Detektor subskrypcji — powtarzające się płatności, podwyżki, martwe subskrypcje
4. Wspólne wydatki — należności od znajomych widoczne w budżecie

Pełna specyfikacja: `docs/PRODUCT.md`

## Kontekst o mnie

Jestem frontend developerem uczącym się full-stacku. Buduj **krok po kroku**
i **wyjaśniaj decyzje architektoniczne**. Chcę rozumieć kod, nie tylko go mieć.

## Stack

```
finso/
├── apps/
│   ├── api/          NestJS + Prisma + PostgreSQL
│   ├── web/          Next.js 15 (App Router) + Tailwind + shadcn/ui
│   └── mobile/       Expo + Expo Router + NativeWind
├── packages/
│   ├── shared/       typy TS, schematy Zod, CZYSTA logika budżetu
│   ├── ui/           design system Vireo
│   └── config/       eslint, tsconfig, tailwind preset
└── turbo.json
```

Monorepo: **Turborepo + pnpm workspaces**
Stan serwera (web i mobile): **TanStack Query**
Formularze: **React Hook Form + Zod**
Testy: **Vitest** (+ Supertest dla API)
Płatności: **RevenueCat** (mobile) + **Stripe** (web)

## Zasady kodu — nienegocjowalne

### Pieniądze
- Kwoty **zawsze jako liczby całkowite w groszach** (Int), nigdy Float
- W Prisma: `Int`, nie `Float`, nie `Decimal` bez uzasadnienia
- Konwersja na format wyświetlania tylko w warstwie prezentacji
- Nigdy nie licz pieniędzy arytmetyką zmiennoprzecinkową

### TypeScript
- Tryb `strict` włączony
- **Zero `any`.** Jeśli nie znasz typu, użyj `unknown` i zawęź
- Typy współdzielone mieszkają w `packages/shared`, nie duplikuj ich

### Logika biznesowa
- Silnik budżetu w `packages/shared` to **czysty TypeScript** —
  zero importów z NestJS, React, Prisma
- Wejście: dane. Wyjście: wyliczenia. Bez efektów ubocznych
- Każda funkcja eksportowana ma JSDoc

### Testy
- **Testy piszesz PRZED implementacją** dla logiki budżetu
- Pokaż mi testy do akceptacji zanim napiszesz kod
- Przypadki brzegowe obowiązkowo: zerowy dochód, ujemne saldo,
  termin celu w przeszłości, pusta historia, rok przestępny, zmiana DST

### UI
- Dark mode od początku, nie jako dodatek
- Mobile-first (i tak portujemy na Expo)
- Każdy widok ma stany: loading (skeleton), error, empty
- Dostępność: nawigacja klawiaturą, aria-labels, kontrast WCAG AA
- shadcn/ui jako baza, ale z tożsamością wizualną Vireo — nie zostawiaj
  domyślnych kolorów

### Bezpieczeństwo
- Hasła: **argon2** (nie bcrypt, nie SHA)
- Rate limiting na endpointach auth
- Walidacja wejścia Zod na granicy API — zawsze
- Sekrety tylko w zmiennych środowiskowych, nigdy w kodzie
- Użytkownik musi móc usunąć konto z danymi (wymóg App Store + RODO)

## Jak ze mną pracujesz

1. **Pytaj, zanim założysz.** Jeśli czegoś nie jestem pewien w specyfikacji,
   zapytaj — nie zgaduj
2. **Nie generuj całego projektu naraz.** Jeden etap, potem stop
3. **Po każdym etapie zatrzymaj się** i wyjaśnij co zrobiłeś i dlaczego
4. Jeśli widzisz, że moje polecenie jest błędne technicznie —
   powiedz mi to, nie wykonuj w milczeniu
5. Commity: konwencja **Conventional Commits** (`feat:`, `fix:`, `chore:`)

## Czego NIE robić

- Nie dodawaj bibliotek spoza stacku bez zapytania mnie
- Nie pisz integracji bankowej (Open Banking) — to Faza 3
- Nie pomijaj testów, „bo to prosta funkcja"
- Nie pisz komentarzy typu `// increment counter` — komentuj *dlaczego*, nie *co*
