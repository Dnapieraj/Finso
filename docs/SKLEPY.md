# Finso w sklepach — teksty i odpowiedzi do wklejenia

Wszystko, co sklepy każą wpisać przy publikacji. Kolejność kroków (konta,
buildy, wysyłka) jest w [PUBLIKACJA.md](PUBLIKACJA.md). Teksty opisują tylko
to, co appka już robi — appka płatna nie może obiecywać funkcji, których nie
ma (decyzja z 12.11.2026 w PRODUCT.md).

Placeholdery do podmiany przed wysłaniem: `finso.app` (domena), `kontakt@finso.app`.

## Wspólne dla obu sklepów

| Pole                  | Wartość                                           |
| --------------------- | ------------------------------------------------- |
| Cena                  | 19,99 zł, jednorazowo (bez zakupów w aplikacji)   |
| Kategoria             | Finanse                                           |
| Język                 | polski                                            |
| Kraje                 | Polska (na start)                                 |
| Polityka prywatności  | https://finso.app/polityka-prywatnosci            |
| Strona / wsparcie     | https://finso.app, e-mail kontakt@finso.app       |
| Usuwanie konta (www)  | https://finso.app/usuwanie-konta                  |
| Reklamy               | brak                                              |
| Śledzenie użytkownika | brak                                              |
| Grupa docelowa        | dorośli (18+) — appka do finansów, nie dla dzieci |

## Google Play

**Nazwa aplikacji** (max 30 znaków):

```
Finso: czy mnie stać?
```

**Krótki opis** (max 80 znaków):

```
Sprawdź, czy stać cię na zakup, zanim wydasz. Budżet od wypłaty do wypłaty.
```

**Pełny opis** (max 4000 znaków):

```
Finso odpowiada na jedno pytanie: czy stać mnie na to teraz? Zanim wydasz pieniądze — nie po fakcie.

CZY MNIE STAĆ?
Wpisz kwotę przed zakupem, a Finso od razu powie, ile zostanie ci do wypłaty, ile wypadnie dziennie i czy któryś cel oszczędnościowy się przesunie.

ILE MOŻESZ DZIŚ WYDAĆ
Budżet liczy się od dnia wypłaty, nie od pierwszego dnia miesiąca. Na starcie widzisz, ile możesz wydać dziś i do końca okresu. Niewydane wczoraj przechodzi na dziś.

NIEREGULARNE DOCHODY
Zlecenia, freelance, napiwki? Finso uczy się, ile zwykle zarabiasz, i planuje z ostrożnej prognozy, a nie z pensji, której nie masz.

STAŁE PŁATNOŚCI I SUBSKRYPCJE
Czynsz, rachunki, abonamenty — Finso odlicza je z budżetu i przypomina o terminach. Sam wykrywa powtarzające się płatności, pokazuje podwyżki cen i pyta o subskrypcje, z których chyba już nie korzystasz.

CELE OSZCZĘDNOŚCIOWE
Ustal kwotę i termin, a Finso wyliczy ratę na każdy okres. Wpłaty zapisujesz z datą i historią.

SZYBKO I WYGODNIE
• Wydatek w trzech dotknięciach, szablony typu „Kawa 14 zł”
• Import wyciągu CSV z banku (mBank, PKO BP, ING i inne) — plik czyta telefon
• Limity na kategorie, historia z wykresem, eksport danych do CSV
• Widżet „Możesz dziś wydać” na ekranie głównym
• Tryb ciemny, ukrywanie kwot, blokada odciskiem palca lub kodem

PRYWATNIE
Bez reklam i bez śledzenia. Twoje dane finansowe nie są sprzedawane ani używane do reklam. Konto usuniesz w każdej chwili w aplikacji.

JEDNA CENA
Płacisz raz przy pobraniu. Bez subskrypcji, bez planów, bez dopłat w aplikacji — wszystkie funkcje i przyszłe aktualizacje w cenie.

Finso nie jest doradcą finansowym: wyliczenia są szacunkami na podstawie danych, które wpisujesz.
```

**Grafiki** — gotowe w `docs/store/google-play/`:

- `feature-graphic.png` — grafika promocyjna 1024×500 (wymagana)
- `01-start.png` … `06-subskrypcje.png` — zrzuty telefonu 1080×1920 (min. 2, max. 8)
- `icon-512.png` — ikona 512×512 (ten sam znak co w appce)

### Bezpieczeństwo danych (Data safety)

| Pytanie                                     | Odpowiedź                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Czy appka zbiera lub udostępnia dane?       | Tak, zbiera                                                                                                               |
| Czy dane są szyfrowane podczas przesyłania? | Tak (HTTPS)                                                                                                               |
| Czy można poprosić o usunięcie danych?      | Tak — w appce i na https://finso.app/usuwanie-konta                                                                       |
| Udostępnianie innym firmom                  | Nie (Resend i Sentry to dostawcy usług działający w naszym imieniu — według definicji Google to nie jest „udostępnianie”) |

Zbierane dane:

| Typ danych (Google)                                                                                | Zbierane | Wymagane | Cel                                     |
| -------------------------------------------------------------------------------------------------- | -------- | -------- | --------------------------------------- |
| Dane osobowe → Adres e-mail                                                                        | tak      | tak      | Działanie aplikacji, zarządzanie kontem |
| Informacje finansowe → Inne informacje finansowe (wydatki, wpływy, cele wpisane przez użytkownika) | tak      | tak      | Działanie aplikacji                     |
| Informacje o aplikacji i wydajności → Logi awarii                                                  | tak      | tak      | Analityka (diagnozowanie awarii)        |
| Informacje o aplikacji i wydajności → Diagnostyka                                                  | tak      | tak      | Analityka (diagnozowanie awarii)        |

Nie zbieramy: lokalizacji, kontaktów, zdjęć, plików (plik CSV z banku czyta
telefon; na serwer trafiają tylko importowane wydatki — już ujęte w
„Inne informacje finansowe”), identyfikatorów urządzenia, historii zakupów
w aplikacji (nie ma zakupów w aplikacji).

> Jeśli nie włączysz Sentry (bez `EXPO_PUBLIC_SENTRY_DSN`), odznacz logi
> awarii i diagnostykę oraz usuń akapit o Sentry z polityki prywatności.

### Klasyfikacja treści (ankieta IARC)

Kategoria: „Narzędzia, produktywność, komunikacja lub inne”. Na wszystkie
pytania o przemoc, seks, wulgaryzmy, hazard, narkotyki, treści od
użytkowników i udostępnianie lokalizacji: **nie**. Zakupy cyfrowe: **nie**
(płatność tylko przy pobraniu). Spodziewany wynik: PEGI 3 / Everyone.

### Grupa docelowa i treści

- Grupa wiekowa: **18 lat i więcej** (bez zgłaszania do programu dla rodzin)
- Reklamy: **nie**
- Aplikacja finansowa — deklaracja „Funkcje finansowe”: **budżetowanie /
  zarządzanie finansami osobistymi**; bez pożyczek, płatności, kryptowalut,
  doradztwa inwestycyjnego
- Dostęp do appki dla recenzentów: patrz „Konto dla recenzentów” niżej

## App Store

| Pole                         | Wartość (limit)                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| Nazwa (30)                   | `Finso: czy mnie stać?`                                                                   |
| Podtytuł (30)                | `Budżet od wypłaty do wypłaty`                                                            |
| Kategoria główna / dodatkowa | Finanse / Produktywność                                                                   |
| Słowa kluczowe (100)         | `budżet,wydatki,finanse,oszczędzanie,wypłata,subskrypcje,cele,limit,pieniądze`            |
| Tekst promocyjny (170)       | `Sprawdź, czy stać cię na zakup, zanim wydasz. Jedna cena, bez subskrypcji i bez reklam.` |
| Opis                         | ten sam co pełny opis w Google Play (bez zmian)                                           |
| Prawa autorskie              | `2026 [Twoje imię i nazwisko lub firma]`                                                  |
| Klasyfikacja wiekowa         | 4+ (wszystkie odpowiedzi „Brak”)                                                          |

**Zrzuty ekranu iPhone'a** — wymagane w rozmiarze 6,9" (1320×2868) lub 6,5"
(1242×2688 / 1284×2778). Zrzutów z Androida Apple nie przyjmie (inny pasek
stanu i nawigacja), a iPhone'a nie da się uruchomić na Windowsie. Zrób je
z buildu z TestFlight na iPhonie: zaloguj się kontem dla recenzentów, ekrany
jak w `docs/store/google-play/` (Start, Symulator z kwotą 349, Cele, Wpłaty,
Historia, Subskrypcje), zrzut = boczny przycisk + głośniej.

### Prywatność w aplikacji (App Privacy)

- Śledzenie (tracking): **Nie**
- Dane powiązane z użytkownikiem:
  - Informacje kontaktowe → Adres e-mail → Funkcjonalność aplikacji
  - Informacje finansowe → Inne informacje finansowe → Funkcjonalność aplikacji
- Dane niepowiązane z użytkownikiem:
  - Diagnostyka → Dane o awariach → Funkcjonalność aplikacji
    (tylko z włączonym Sentry)

### Eksport szyfrowania

Odpowiedź ustawiona w `app.json` (`usesNonExemptEncryption: false`) — appka
używa tylko szyfrowania HTTPS systemu, App Store Connect nie zapyta o to przy
każdym buildzie.

## Konto dla recenzentów

Oba sklepy wymagają działającego konta testowego. Na produkcji załóż je
skryptem (dane realistyczne, daty od dziś; hasło tylko ze zmiennej):

```
SHOWCASE_PASSWORD='<silne hasło, min. 12 znaków>' pnpm --filter api db:showcase
```

(w kontenerze hostingu: `pnpm db:showcase` w katalogu `apps/api`). Przed
wysłaniem nowej wersji do recenzji odśwież daty: `pnpm db:showcase -- --reset`.

**Notatka dla recenzenta** (App Review Information / Instrukcje dostępu):

```
Login: recenzja@finso.app
Password: <SHOWCASE_PASSWORD>

Finso is a paid app with no in-app purchases or subscriptions; all features are available after download.
The account contains sample data: salary, fixed payments, two subscriptions, savings goals with deposits and expenses.
Try: "Symulator" tab — enter an amount to see if it is affordable. "+" on Start adds an expense in three taps.
Account deletion: Ustawienia (Settings) → Usuń konto → confirm with the password. The account and all data are deleted immediately.
Notifications are local reminders only (no push server).
```

Lokalnie to samo konto: `pnpm --filter api db:showcase` (hasło
`recenzja-haslo-123`, tylko baza deweloperska).
