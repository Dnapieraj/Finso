# Finso — brief produktowy i techniczny
**Marka parasolowa: Vireo** · Pierwszy produkt: **Finso**

> **Podział ról (wrzesień 2026):** Finso to **aplikacja mobilna** (iOS + Android, `apps/mobile`) —
> tam jest cała funkcjonalność. `apps/web` to **wyłącznie strona wizytówkowa**: hero, wyróżniki,
> jak działa, cennik, linki do sklepów, polityka prywatności, regulamin, usuwanie konta.
> Bez logowania i bez danych użytkownika. Fragmenty niżej, które mówią o „aplikacji webowej”,
> są nieaktualne tam, gdzie się z tym kłócą.

---

## 1. Marka

**Vireo** — firma parasolowa. Pod nią w przyszłości: Finso (finanse), potem todo, potem cokolwiek dalej.

Co to znaczy praktycznie od początku:
- Jedno konto użytkownika działa we wszystkich produktach Vireo (SSO) — zaprojektuj auth jako osobny serwis od razu, nie wbudowany w Finso
- Wspólny design system (paleta, typografia, komponenty) w `packages/ui` — kolejny produkt startuje szybciej
- Domeny: `vireo.app` (marka), `finso.app` lub `getfinso.com` (produkt)

**Sprawdź dostępność domen i nazw w rejestrze znaków towarowych zanim zainwestujesz w branding.** "Finso" to krótkie słowo, możliwe że zajęte w niektórych krajach.

---

## 2. Pozycjonowanie Finso — czego nie ma na rynku

### Problem z istniejącymi appkami
Kontomierz, Spendee, Wallet, YNAB, Revolut Analytics — prawie wszystkie **raportują przeszłość**. Pokazują ładne wykresy tego, co już wydałeś. To za późno. Decyzja finansowa zapada **w momencie zakupu**, nie miesiąc później przy przeglądaniu wykresu.

### Pozycjonowanie Finso (jedno zdanie)
> Finso odpowiada na pytanie „czy stać mnie na to teraz" — zanim wydasz pieniądze, nie po fakcie.

### Cztery realne luki, które Finso wypełnia

#### A. Symulator decyzji — „Czy mnie na to stać?"
Wpisujesz kwotę i kategorię *przed* zakupem. Finso odpowiada w sekundę:
- „Tak — zostanie Ci 340 zł na 12 dni (28 zł/dzień)"
- „Tak, ale cel »Wakacje« przesunie się o 3 tygodnie"
- „Nie — zabraknie Ci 180 zł przed wypłatą"

To jest **rdzeń produktu**. Widżet na ekranie głównym telefonu, żeby sprawdzić w sklepie w 3 sekundy. Tego nikt porządnie nie zrobił.

#### B. Nieregularne dochody
Prawie każda appka zakłada „pensja 1. dnia miesiąca". A realnie: studenci dorabiający na zleceniach, freelancerzy, kelnerzy z napiwkami, kierowcy, korepetytorzy.

Finso obsługuje to inaczej:
- Uczy się Twojego **średniego dochodu z ostatnich 3–6 miesięcy** i jego zmienności
- Liczy budżet nie od „następnej wypłaty", tylko od **realistycznej prognozy z buforem bezpieczeństwa**
- Tryb „chudy miesiąc": jeśli wpływy są niższe niż zwykle, automatycznie proponuje, co przyciąć

To jest duża, niezagospodarowana grupa i mocny wyróżnik w opisie w App Store.

#### C. Detektor wycieków — subskrypcje i podwyżki
Ludzie tracą realne pieniądze na rzeczach, o których zapomnieli.
- Finso wykrywa powtarzające się kwoty i oznacza je jako prawdopodobne subskrypcje
- Wykrywa **podwyżkę ceny**: „Spotify wzrósł z 23 zł na 27 zł w marcu — +48 zł rocznie"
- Wykrywa **martwe subskrypcje**: „Płacisz za X od 8 miesięcy, ale nigdy nie oznaczyłeś tego jako używane — anulować?"
- Podsumowanie: „Twoje subskrypcje to 217 zł/mies. = 2604 zł/rok"

#### D. Wspólne wydatki wliczone do budżetu
Splitwise rozlicza długi, ale nie wie nic o Twoim budżecie. Twoja appka budżetowa nie wie nic o tym, że kolega odda Ci 200 zł w piątek.

Finso łączy jedno z drugim:
- Dzielisz rachunek ze współlokatorami / ze znajomymi
- Kwota „do odzyskania" jest widoczna w budżecie jako **należność w drodze**, a nie zniknięte pieniądze
- Przypomnienia o rozliczeniu

---

## 3. Funkcje — podział na fazy

Wszystkie funkcje poniżej żyją w aplikacji mobilnej. Web tylko je opisuje.

### MVP (Faza 1) — to wypuszczasz
1. Rejestracja/logowanie (e-mail + Google/Apple)
2. Onboarding: źródła dochodu (regularne lub nieregularne), stałe zobowiązania
3. Dodawanie wydatków (ręcznie, szybko — max 3 tapnięcia)
4. **Symulator „czy mnie na to stać"** ← wyróżnik, musi być w MVP
5. Cele oszczędnościowe z automatycznym wyliczeniem rat
6. Potwierdzanie cyklicznych wydatków (tak/nie/inna kwota)
7. Dashboard: ile zostało, ile dziennie, prognoza do końca okresu
8. Historia + wykres wg kategorii

### Faza 2
9. Detektor subskrypcji i podwyżek cen
10. Nieregularne dochody — uczenie się wzorca
11. Wspólne wydatki / rozliczenia
12. Widżety iOS/Android
13. Tryb offline z synchronizacją

### Faza 3
14. Integracja bankowa (Open Banking / PSD2) — **duży temat prawny, wymaga licencji AISP lub pośrednika typu Salt Edge/Kontomatik; nie zaczynaj od tego**
15. Wielowalutowość
16. Eksport PDF/CSV, raporty roczne

### Znane uproszczenia silnika budżetu (Faza 1 → do rewizji w Fazie 2)

**`simulatePurchase` liczy wpływ zakupu na każdy zagrożony cel NIEZALEŻNIE,
nie jako jeden spójny podział deficytu między cele.** Przy dwóch aktywnych
celach i zakupie, który tworzy niedobór, symulator pokaże PEŁNE opóźnienie
dla KAŻDEGO celu z osobna (liczone tak, jakby to on jeden wchłonął cały
deficyt, capped do własnego wkładu zaplanowanego w tym okresie) — nie jeden
scenariusz, w którym deficyt jest realistycznie rozdzielony między cele.

Przykład: deficyt 1300 zł, cel "Wakacje" miał dostać 1000 zł w tym okresie,
cel "Poduszka" 800 zł. Apka pokaże "Wakacje +31 dni" ORAZ "Poduszka +29 dni"
jednocześnie — te liczby się nie sumują do realnego stanu budżetu (brakuje
1300 zł, nie 1800 zł).

Świadomy wybór: dużo prostszy do policzenia i przetestowania niż
proporcjonalna atrybucja deficytu między celami. Zaakceptowany na MVP.
Do rewizji w Fazie 2, jeśli feedback użytkowników pokaże, że to myli.
(Implementacja: `packages/shared/src/budget/types.ts`, JSDoc `GoalImpact`.)

---

## 4. Stack — pełna specyfikacja

### Monorepo
```
finso/
├── apps/
│   ├── api/          NestJS — backend
│   ├── web/          Next.js 16 — strona wizytówkowa (statyczna)
│   └── mobile/       Expo (React Native) — cała aplikacja, iOS + Android
├── packages/
│   ├── shared/       typy TS, schematy Zod, logika biznesowa budżetu
│   ├── ui/           design system Vireo (współdzielony)
│   └── config/       eslint, tsconfig, prettier
└── turbo.json
```

Narzędzie: **Turborepo** + **pnpm workspaces**

### Backend — `apps/api`
| Element | Wybór | Dlaczego |
|---|---|---|
| Framework | **NestJS** | struktura modułowa, DI, świetnie wygląda w portfolio, standard w ogłoszeniach |
| Język | **TypeScript** (strict) | |
| ORM | **Prisma** | typy generowane z schemy, migracje, świetny DX |
| Baza | **PostgreSQL** | |
| Walidacja | **Zod** | te same schematy współdzielone z frontendem |
| Auth | **Auth.js** lub **Lucia** + JWT | |
| Testy | **Vitest** + **Supertest** | |
| Dokumentacja API | **Swagger** (wbudowany w NestJS) | |
| Kolejki/cron | **BullMQ** + Redis | powiadomienia, wykrywanie subskrypcji |

#### Usuwanie danych — który mechanizm

Trzy mechanizmy to odpowiedzi na **dwa różne pytania**, a nie trzy
wersje tego samego:

**1. „To przestało obowiązywać od teraz”** (zmiana pracy, anulowana
subskrypcja) → **archiwizacja: `isActive: false`**. Rzecz znika z prognoz
i budżetu, ale historia nadal się do niej odwołuje i pokazuje ją w
raportach. To zwykła edycja (`PATCH`), a nie usuwanie.

**2. „To ma zniknąć”** (pomyłka, duplikat) → `DELETE`. Sposób zależy od
tego, czym jest rekord:

| Rodzaj rekordu | `DELETE` robi | Dlaczego |
|---|---|---|
| **Fakt finansowy** (pieniądze, które się ruszyły) albo **postęp** | miękkie usunięcie: `deletedAt` + `POST /:id/restore` | utrata jest kosztowna i zwykle przypadkowa, więc użytkownik musi móc cofnąć |
| **Konfiguracja** (kategoria, reguła, źródło) | twarde usunięcie | nie ma czego przywracać, bo to ustawienie, nie historia |

Zasada nadrzędna: **usunięcie konfiguracji nigdy nie kasuje faktów.**
Klucze obce od faktów do konfiguracji mają `onDelete: SetNull` (fakt
zostaje bez powiązania) albo `NoAction` (usunięcie jest blokowane, 409,
a konfigurację trzeba zarchiwizować). `Cascade` jest dozwolone tylko od
`User`: usunięcie konta ma skasować wszystko (RODO).

Obecne encje:

| Encja | Rodzaj | Archiwizacja | `DELETE` |
|---|---|---|---|
| Transaction | fakt | — | miękkie |
| IncomeEntry | fakt | — | miękkie |
| Goal | postęp | — | miękkie |
| RecurringRule | konfiguracja | `isActive` | twarde; transakcje → `SetNull` |
| IncomeSource | konfiguracja | `isActive` | twarde tylko bez wpływów (także tych w koszu); inaczej 409 (`NoAction`) |
| Category | konfiguracja | — | twarde; transakcje i reguły → `SetNull` |
| User | — | — | twarde, kaskadowo wszystko, wymaga hasła |

**Nowa encja? Zadaj oba pytania:**
1. Czy może „przestać obowiązywać”, a jej historia ma zostać? → dodaj `isActive`.
2. Czy jest faktem finansowym lub postępem użytkownika? → `deletedAt`,
   dopisz model do soft-delete extension (`apps/api/src/prisma/soft-delete.extension.ts`),
   dodaj `restore` i wiersz `restorable` w teście izolacji. W przeciwnym razie
   usuwaj twardo, ale sprawdź `onDelete` każdej relacji wskazującej na nią.

**Znane ograniczenie:** kosz nie ma jeszcze opróżniania. Źródło dochodu,
którego jedyne wpływy leżą w koszu, nadal nie da się usunąć, tylko
zarchiwizować. Rozwiąże to przyszłe „opróżnij kosz”, czyli twarde
usunięcie rekordów z `deletedAt`.

### Web — `apps/web` (strona wizytówkowa)
| Element | Wybór |
|---|---|
| Framework | **Next.js 16** (App Router), generowanie statyczne (SSG) |
| Style | **Tailwind CSS v4** + tokeny `@vireo/ui` |
| Komponenty | **shadcn/ui** (Base UI) w stylu Vireo |
| SEO | metadane, obrazy OG, sitemap, robots |
| Podstrony | `/`, `/polityka-prywatnosci`, `/regulamin`, `/usuwanie-konta` |
| Później | `apple-app-site-association` i `assetlinks.json` (linki z e-maili otwierają aplikację) |

Bez logowania, bez TanStack Query, bez formularzy i bez wywołań API.

### Mobile — `apps/mobile`
| Element | Wybór |
|---|---|
| Framework | **React Native + Expo (SDK 57)** |
| Nawigacja | **Expo Router** (file-based, jak Next.js) |
| Style | **NativeWind** (Tailwind w RN — te same tokeny co strona) |
| Stan serwera | **TanStack Query** |
| Wykresy | **Victory Native XL** |
| Push | **Expo Notifications** |
| Bezpieczne przechowywanie | **expo-secure-store** |
| Build/deploy | **EAS Build** + **EAS Submit** |

### Płatności
- **RevenueCat** — warstwa nad Apple IAP + Google Play Billing
- **Krytyczne:** subskrypcja sprzedawana w appce mobilnej **musi** iść przez Apple IAP / Google Billing (prowizja 15–30%). Nie da się tego obejść Stripe'em wewnątrz appki. RevenueCat to ujednolica i daje jedno źródło prawdy o statusie subskrypcji w backendzie (webhooki).
- ~~Web: Stripe Checkout~~ — **porzucone**: web nie ma logowania, więc nie ma do czego przypisać zakupu. Subskrypcje sprzedajemy wyłącznie w aplikacji (RevenueCat). Web pokazuje cennik i kieruje do sklepów.

### Infrastruktura
| Co | Gdzie |
|---|---|
| Web | **Vercel** |
| API | **Railway** lub **Fly.io** |
| Baza | **Neon** (serverless Postgres) lub **Supabase** |
| Pliki (paragony) | **Cloudflare R2** lub Supabase Storage |
| Monitoring błędów | **Sentry** (web + mobile + API) |
| Analityka produktowa | **PostHog** |
| CI/CD | **GitHub Actions** |

---

## 5. Bezpieczeństwo i prawo — nie pomijaj

Appka finansowa to dane wrażliwe. Do portfolio i do realnego wypuszczenia potrzebujesz:
- **Hashowanie haseł:** argon2 (nie bcrypt, nie SHA)
- **Szyfrowanie wrażliwych pól** w bazie (at-rest)
- **Rate limiting** na endpointach auth
- **RODO/GDPR:** polityka prywatności, eksport danych użytkownika, usunięcie konta z danymi
- **Apple App Store** wymaga przycisku „usuń konto" wewnątrz appki, jeśli jest rejestracja — inaczej odrzucą review
- **Google Play** wymaga dodatkowo strony internetowej, na której można poprosić o usunięcie konta bez instalowania aplikacji → `apps/web` `/usuwanie-konta` (instrukcja + adres e-mail)
- Regulamin i polityka prywatności są **wymagane** przy publikacji w obu sklepach

Nie jestem prawnikiem — przy sprzedaży subskrypcji w Polsce skonsultuj kwestie podatkowe i formę działalności.

---

## 6. Monetyzacja

**Finso Free**
- Ręczne wydatki bez limitu
- 1 cel oszczędnościowy
- Historia 60 dni
- Symulator „czy mnie stać" — 5 użyć dziennie

**Finso Plus — 12,99 zł/mies. lub 99 zł/rok**
- Nielimitowane cele i symulacje
- Detektor subskrypcji i podwyżek
- Nieregularne dochody / prognozy
- Wspólne wydatki
- Pełna historia, eksport danych
- Widżety

Rocznie z wyraźnym rabatem (~36%) — to standard, bo poprawia retencję i cashflow.

Zakup **wyłącznie w aplikacji** (Apple IAP / Google Play Billing przez RevenueCat). Strona web pokazuje ten cennik i linki do sklepów.

---

## 7. Kolejność budowania

| Etap | Co | Przybliżony czas |
|---|---|---|
| 0 | Setup monorepo, wspólny config, CI — **zrobione** | 2–3 dni |
| 1–2 | Model danych: schema Prisma, soft delete, docker-compose, migracje, seed kategorii — **zrobione** | — |
| 3 | **Silnik budżetu** w `packages/shared` + testy jednostkowe — **zrobione** | 1 tydz. |
| 4 | API: auth, CRUD zasobów, testy e2e izolacji (4a); składanie wejścia silnika i endpointy `/budget` (4b) — **zrobione** | 1–2 tyg. |
| 5 | Design system Vireo: tokeny i paleta „Oliwka” (5a), `formatMoney` i komponenty `@vireo/ui` (5b) — **zrobione** | — |
| 6 | **Web: strona wizytówkowa** — zmiana kierunku na wizytówkę (6.0–6.1, **zrobione**), strona główna (6.2, **zrobione**), strony prawne i SEO (6.3, **zrobione**) | kilka dni |
| 7 | **Mobile: cała aplikacja** — Expo + NativeWind, komponenty RN, auth, dashboard, dodawanie wydatków, symulator, cele, historia, onboarding, push, paywall RevenueCat | 4–6 tyg. |
| 8 | Publikacja: App Store + Google Play + Vercel | 1–2 tyg. (review trwa) |

_Numeracja etapów 0–6 odpowiada historii commitów (np. „etap 3” = silnik budżetu, „etap 5a” = tokeny).
Etapy 1 i 2 nie mają oznaczeń w commitach, więc są opisane łącznie._

**Do zrobienia przed publikacją (etap 8) — placeholdery w `apps/web`:**
- Przyciski „Pobierz z App Store / Google Play” zamienić na **oficjalne grafiki sklepów** (wymagają ich wytyczne marketingowe Apple i Google) — `apps/web/src/components/landing/store-buttons.tsx`
- Linki do sklepów zamiast `#` — `apps/web/src/content/links.ts`
- Domena `https://finso.app`, e-mail `kontakt@finso.app` i administrator danych (`[Administrator — do uzupełnienia]`) to placeholdery — podmienić w `apps/web/src/content/site.ts`
- **Przegląd prawny** polityki prywatności i regulaminu (`apps/web/src/messages/legal/`) — obecne teksty to szkice
- Założenia do potwierdzenia przy wyborze hostingu: serwery w UE, kopie zapasowe nadpisywane w ciągu 30 dni
- Każda nowa usługa przetwarzająca dane (np. Sentry, PostHog) → dopisać do polityki prywatności (test `legal.spec.ts` to wymusza)
- **TODO — polityka prywatności do aktualizacji, gdy powstanie:** zdjęcia paragonów (`Transaction.receiptUrl` + dostawca przechowywania plików, np. Cloudflare R2) albo logowanie przez Google/Apple (nowi odbiorcy danych i nowe dane konta)

_Pierwotny plan zakładał dashboard na webie i port na Expo; zmieniony we wrześniu 2026 — web jest tylko wizytówką._

**Kluczowa rada:** silnik liczenia budżetu (etap 3) napisz jako **czystą funkcję w `packages/shared`, bez zależności od frameworka, pokrytą testami**. Web i mobile tylko ją wywołują. To jest sedno appki i to najlepiej wygląda w portfolio.

---

## 8. Prompty do Claude Code

### Prompt 1 — start projektu

```
Buduję aplikację Finso — menadżer finansów osobistych (web + iOS + Android).
Marka parasolowa: Vireo. Uczę się full-stacku, jestem frontend developerem,
więc buduj krok po kroku i wyjaśniaj decyzje architektoniczne.

POZYCJONOWANIE:
Finso odpowiada na pytanie "czy stać mnie na to TERAZ", zanim użytkownik
wyda pieniądze — nie raportuje przeszłości jak inne appki.

Kluczowe wyróżniki:
1. Symulator decyzji: użytkownik wpisuje planowany wydatek, appka mówi
   ile zostanie na dzień do wypłaty i jak to wpłynie na cele oszczędnościowe
2. Obsługa nieregularnych dochodów (freelancerzy, studenci) — budżet liczony
   z prognozy i zmienności, nie ze stałej pensji
3. Detektor subskrypcji: wykrywa powtarzające się płatności, podwyżki cen
   i nieużywane subskrypcje
4. Wspólne wydatki: należności od znajomych widoczne w budżecie

STACK:
- Monorepo: Turborepo + pnpm workspaces
- apps/api: NestJS + Prisma + PostgreSQL + Zod + Vitest
- apps/web: Next.js 15 App Router + Tailwind + shadcn/ui + TanStack Query
- apps/mobile: Expo + Expo Router + NativeWind (później)
- packages/shared: typy TS, schematy Zod, CZYSTA logika budżetu
- packages/ui: design system Vireo

ZADANIE NA TERAZ (etap 0):
1. Zainicjuj monorepo Turborepo + pnpm ze strukturą wyżej
2. Skonfiguruj współdzielone tsconfig, eslint, prettier w packages/config
3. Postaw apps/api (NestJS) z podłączonym Prisma i pustą schemą
4. Postaw apps/web (Next.js 15) z Tailwind + shadcn/ui
5. Dodaj GitHub Actions: lint + typecheck + test przy każdym pushu

Zanim zaczniesz pisać kod — zadaj mi pytania o wszystko, czego nie
jesteś pewien. Nie generuj całego projektu naraz. Po każdym etapie
zatrzymaj się i wyjaśnij co zrobiłeś.
```

### Prompt 2 — model danych

```
Etap 1: zaprojektuj schemę Prisma dla Finso.

Encje do pokrycia:
- User (auth, plan subskrypcji, waluta, strefa czasowa, revenuecat_id)
- IncomeSource (źródło dochodu: regularne ze stałą datą LUB nieregularne
  z historią do uczenia się wzorca)
- IncomeEntry (konkretny wpływ: kwota, data, status potwierdzenia)
- Transaction (wydatek: kwota, kategoria, data, notatka, paragon,
  status confirmed/pending/declined)
- Category (systemowe + własne użytkownika: nazwa, ikona, kolor)
- Goal (cel oszczędnościowy: kwota docelowa, termin, bieżący postęp,
  wyliczona rata)
- RecurringRule (reguła cykliczności dla dochodów i wydatków)
- DetectedSubscription (wykryta subskrypcja: dostawca, kwota, historia
  zmian ceny, ostatnia aktywność)
- SharedExpense + SharedExpenseParticipant (wspólne wydatki i należności)

Wymagania:
- Kwoty jako Decimal, NIGDY Float (to appka finansowa)
- Wszystkie kwoty przechowuj w groszach jako Int LUB Decimal — zaproponuj
  i uzasadnij wybór
- Soft delete tam gdzie ma sens
- Indeksy pod zapytania: transakcje użytkownika w zakresie dat
- created_at / updated_at wszędzie

Napisz schemę, wyjaśnij każdą decyzję, i zapytaj mnie o wątpliwe
miejsca zanim wygenerujesz migrację.
```

### Prompt 3 — silnik budżetu (najważniejszy)

```
Etap 2: zbuduj silnik budżetu w packages/shared.

To ma być CZYSTY TypeScript — zero zależności od NestJS, React czy
bazy danych. Wejście: dane. Wyjście: wyliczenia. W pełni testowalne.

Funkcje do zaimplementowania:

1. calculateAvailableBalance(input)
   Ile użytkownik może swobodnie wydać do końca bieżącego okresu
   budżetowego, po odjęciu: stałych zobowiązań, rat celów
   oszczędnościowych, i już poniesionych wydatków.

2. simulatePurchase(input, amount, categoryId)
   Zwraca: czy stać, ile zostanie, ile dziennie do wypłaty,
   wpływ na każdy cel oszczędnościowy (opóźnienie w dniach),
   poziom ryzyka (safe/tight/over).

3. forecastIrregularIncome(history)
   Dla nieregularnych dochodów: mediana, odchylenie, prognoza
   konserwatywna (np. 25. percentyl) na następny okres.

4. detectRecurringPatterns(transactions)
   Wykrywa powtarzające się płatności (tolerancja kwoty ±10%,
   tolerancja dni ±3), zwraca prawdopodobne subskrypcje
   i wykryte zmiany ceny.

5. calculateGoalContribution(goal, periodsRemaining)
   Ile trzeba odkładać na okres, żeby zdążyć przed terminem.

WYMAGANIA:
- Arytmetyka na liczbach całkowitych (grosze) lub decimal.js —
  nigdy float
- Każda funkcja pokryta testami Vitest, w tym przypadki brzegowe:
  zerowy dochód, ujemne saldo, termin celu w przeszłości,
  pusty history, przestępny rok, zmiana strefy czasowej
- Pełne typy, brak `any`
- JSDoc przy każdej funkcji eksportowanej

Napisz najpierw testy, potem implementację. Pokaż mi testy do
akceptacji zanim napiszesz kod.
```

### Prompt 4 — frontend (nieaktualny)

> **Nieaktualny:** te ekrany powstają w `apps/mobile`, nie w `apps/web`. Zostawiony jako zapis
> wymagań dla ekranów aplikacji.

```
Etap 3: apps/web — dashboard i symulator.

Ekrany:
1. Dashboard — duża liczba "możesz wydać X zł" na środku, pod spodem
   kwota dzienna, pasek postępu okresu, lista celów, ostatnie transakcje
2. Szybkie dodawanie wydatku — modal, max 3 interakcje do zapisu
3. Symulator "czy mnie stać" — input kwoty, natychmiastowa odpowiedź
   z kolorowym wskaźnikiem ryzyka i wpływem na cele
4. Cele — lista z paskami postępu i wyliczoną ratą
5. Historia — filtry, wykres wg kategorii (Recharts)

WYMAGANIA UI:
- shadcn/ui jako baza, ale nadaj tożsamość wizualną Vireo:
  zaproponuj paletę i typografię, nie zostawiaj domyślnych
- Dark mode od początku
- Mobile-first (i tak potem port na Expo)
- Wszystkie stany: loading (skeleton), error, empty
- Optimistic updates przez TanStack Query
- Dostępność: nawigacja klawiaturą, aria-labels, kontrast WCAG AA

Zacznij od Dashboardu. Pokaż mi go, zbiorę feedback, potem kolejne ekrany.
```

---

## 9. Trzy rady na koniec

1. **Nie buduj wszystkiego naraz.** Symulator „czy mnie stać" + podstawowy budżet to jest produkt, który można wypuścić. Detektor subskrypcji i wspólne wydatki to Faza 2. Skończona mała appka bije nieskończoną dużą — i w portfolio, i na rynku.

2. **Testuj silnik budżetu obsesyjnie.** To jedyna część, gdzie błąd jest niewybaczalny — appka finansowa, która źle liczy, traci zaufanie natychmiast. To też najlepiej wygląda w code review u rekrutera.

3. **Nie oczekuj od Claude Code kodu „bez żadnych błędów".** Żadne narzędzie tego nie gwarantuje. Zabezpieczenie to testy, typy TypeScript w trybie strict, CI od pierwszego dnia i to, że sam rozumiesz kod. Proś Claude Code o wyjaśnienia i pytania, nie tylko o gotowy kod — inaczej skończysz z projektem, którego nie umiesz obronić na rozmowie o pracę.
