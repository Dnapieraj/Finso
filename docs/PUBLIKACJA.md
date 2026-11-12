# Publikacja Finso — krok po kroku

Kod, testy, konfiguracja buildów, obraz API, teksty i grafiki do sklepów są
gotowe. Zostają kroki, które wymagają Twoich kont, płatności i decyzji.
Teksty do wklejenia: [SKLEPY.md](SKLEPY.md).

Szacunkowe koszty stałe (sprawdź aktualne cenniki):

| Co                          | Koszt                            |
| --------------------------- | -------------------------------- |
| Google Play Console         | 25 USD jednorazowo               |
| Apple Developer Program     | 99 USD rocznie                   |
| Domena `.app` / `.pl`       | ok. 50–100 zł rocznie            |
| Hosting API + baza (UE)     | ok. 30–150 zł miesięcznie        |
| Resend, Sentry, Vercel, EAS | plany darmowe wystarczą na start |

## 0. Zanim zaczniesz — ważne terminy

- **Nowe osobiste konto Google Play** musi przed publikacją przeprowadzić
  **test zamknięty z co najmniej 12 testerami przez 14 dni** (wymóg Google dla
  kont osobistych). Konto firmowe tego nie wymaga, ale potrzebuje numeru
  D-U-N-S. Załóż konto jak najwcześniej i od razu zbieraj testerów.
- Weryfikacja tożsamości w Google i Apple trwa od kilku godzin do kilku dni.
- Recenzja Apple: zwykle 1–3 dni; pierwsza bywa odrzucona za drobiazgi.

## 1. Konta i domena

1. **Domena** (np. `finso.app` albo `finso.pl`) i skrzynka e-mail kontaktowa.
2. **Google Play Console** — https://play.google.com/console (25 USD).
3. **Apple Developer Program** — https://developer.apple.com/programs (99 USD/rok).
4. **Expo (EAS)** — https://expo.dev, konto darmowe.
5. **Resend** — https://resend.com, konto darmowe (wysyłka kodów e-mail).
6. **Sentry** (opcjonalnie) — https://sentry.io, przy zakładaniu organizacji
   wybierz **region danych: UE (Frankfurt)**.

## 2. Podmień placeholdery w kodzie

Jedna zmiana w każdym miejscu, potem `pnpm lint && pnpm typecheck && pnpm test`:

| Co                   | Plik                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domena strony        | `apps/web/src/content/site.ts` (`siteUrl`), `apps/mobile/src/support/support.ts` (`SITE_URL`)                                                                                        |
| E-mail kontaktowy    | `apps/web/src/content/site.ts` (`contactEmail`), `apps/mobile/src/support/support.ts` (`CONTACT_EMAIL`), `apps/mobile/src/messages/pl.ts` (tekst eksportu) — testy pilnują zgodności |
| Administrator danych | `apps/web/src/content/site.ts` (`dataController`) — imię i nazwisko lub firma z adresem                                                                                              |
| Adres API produkcji  | `apps/mobile/eas.json` (`EXPO_PUBLIC_API_URL` w `preview` i `production`)                                                                                                            |
| Nadawca e-maili      | zmienna `MAIL_FROM` na hostingu (domena zweryfikowana w Resend)                                                                                                                      |

**Przegląd prawny** regulaminu i polityki prywatności
(`apps/web/src/messages/legal/`) — obecne teksty to szkice opisujące dokładnie
to, co robi kod. Warto, żeby przejrzał je prawnik (RODO, prawa konsumenta).

## 3. API i baza danych na hostingu (UE)

Obraz: `apps/api/Dockerfile` (budowany z katalogu głównego repozytorium; CI
buduje go przy każdym pushu). Przy starcie sam robi migracje bazy i dodaje
kategorie systemowe.

Wybierz hosting z **serwerami w UE** i **codziennymi kopiami bazy z
odtwarzaniem do punktu w czasie** (polityka prywatności obiecuje UE i
nadpisywanie kopii w ciągu 30 dni). Przykłady: Render (Frankfurt), Railway
(region UE), Fly.io (Frankfurt) z Neon lub Supabase (Frankfurt) jako baza.

1. Utwórz bazę PostgreSQL (wersja 16+) w regionie UE, włącz kopie zapasowe.
2. Utwórz usługę z obrazu Docker: repozytorium, Dockerfile `apps/api/Dockerfile`,
   kontekst = katalog główny.
3. Zmienne środowiskowe (sekrety tylko w panelu hostingu):

   | Zmienna             | Wartość                                                    |
   | ------------------- | ---------------------------------------------------------- |
   | `NODE_ENV`          | `production`                                               |
   | `DATABASE_URL`      | adres bazy od hostingu (z `sslmode=require`, jeśli wymaga) |
   | `JWT_ACCESS_SECRET` | losowy, min. 32 znaki — wygeneruj poniższym poleceniem     |
   | `EMAIL_CODE_SECRET` | inny losowy, min. 32 znaki                                 |
   | `RESEND_API_KEY`    | klucz z Resend                                             |
   | `MAIL_FROM`         | `Finso <kontakt@twojadomena>`                              |
   | `TRUST_PROXY_HOPS`  | `1` (hosting ma serwer pośredniczący przed API)            |
   | `MIN_APP_VERSION`   | `1.0.0`                                                    |

   Sekret: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

4. Podepnij domenę API (np. `api.twojadomena`) z HTTPS.
5. Sprawdź: `https://api.twojadomena/health` → `{"status":"ok"}`.
6. **Raz sprawdź odtworzenie kopii zapasowej** na osobnej bazie (hosting ma to
   zwykle jako „restore to new database”).
7. Konto dla recenzentów (patrz SKLEPY.md):
   `SHOWCASE_PASSWORD='<hasło>' pnpm db:showcase` w konsoli usługi (`apps/api`).

## 4. E-maile (Resend)

1. Resend → Domains → dodaj domenę, wpisz u rejestratora rekordy DNS
   (SPF, DKIM) i poczekaj na weryfikację.
2. Utwórz klucz API → `RESEND_API_KEY` na hostingu.
3. Test: w appce „Nie pamiętam hasła” → kod powinien przyjść na skrzynkę.

## 5. Strona www (Vercel)

1. Vercel → New Project → to repozytorium, **Root Directory: `apps/web`**.
2. Podepnij domenę główną.
3. Sprawdź `/`, `/regulamin`, `/polityka-prywatnosci`, `/usuwanie-konta`,
   `/sitemap.xml`, `/robots.txt`.

## 6. Zgłaszanie awarii (Sentry, opcjonalnie)

1. Sentry → nowy projekt **React Native** w organizacji z regionem UE.
2. Skopiuj DSN i dodaj go do EAS (krok 7):
   `eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value "<DSN>" --environment production --visibility plaintext`
3. Bez tego kroku appka nic nie wysyła — wtedy usuń akapit o Sentry z polityki
   prywatności i odznacz logi awarii w Data safety (SKLEPY.md).
4. Mapy źródeł (czytelne ślady błędów) to osobny, późniejszy krok: plugin
   `@sentry/react-native/expo` w `app.json` i `SENTRY_AUTH_TOKEN` w EAS.

## 7. Buildy (EAS)

W `apps/mobile`:

```
npm install -g eas-cli
eas login
eas init            # wpisze projectId do app.json — zrób commit
eas build --platform android --profile production
eas build --platform ios --profile production
```

Przy pierwszym buildzie iOS EAS poprosi o zalogowanie do konta Apple
i sam utworzy certyfikaty. Identyfikator appki `app.finso` (Android i iOS)
jest ustalony i **po pierwszej publikacji nie da się go zmienić**.

Profil `preview` (`eas build -p android --profile preview`) daje plik APK do
zainstalowania na własnym telefonie przed wysłaniem do sklepu — sprawdź na nim
wibracje, powiadomienia i odcisk palca (emulator ich nie ma).

## 8. Google Play Console

1. **Utwórz aplikację**: nazwa z SKLEPY.md, język polski, **aplikacja płatna**.
   Uwaga: darmowej appki nie da się później zrobić płatną.
2. **Profil płatności** (Ustawienia → Profil płatności) — potrzebny do
   sprzedaży; potem cena **19,99 zł** w „Ceny aplikacji”.
3. **Strona sklepu**: teksty i grafiki z SKLEPY.md (`docs/store/google-play/`).
4. **Zawartość aplikacji**: polityka prywatności, dostęp do appki (konto dla
   recenzentów), reklamy (nie), klasyfikacja treści, grupa docelowa (18+),
   bezpieczeństwo danych, aplikacje finansowe, usuwanie konta (URL
   `/usuwanie-konta`) — wszystkie odpowiedzi w SKLEPY.md.
5. **Integralność aplikacji → Automatyczna ochrona: włącz** — Google sprawdza,
   czy appka pochodzi ze sklepu (zamiast własnego kodu, decyzja w PRODUCT.md).
6. **Testy zamknięte** (konto osobiste: 12 testerów, 14 dni): wgraj plik AAB
   z `eas build` (albo `eas submit -p android`), dodaj testerów.
7. **Produkcja**: utwórz wersję z tym samym buildem, wyślij do sprawdzenia.

## 9. App Store Connect

1. **Umowy, podatki i bankowość**: zaakceptuj umowę „Paid Apps”, uzupełnij
   konto bankowe i formularze podatkowe — bez tego nie da się sprzedawać.
2. **Moje aplikacje → Nowa aplikacja**: iOS, nazwa, język polski, Bundle ID
   `app.finso`, SKU np. `finso-ios`.
3. **Cena**: 19,99 zł (w „Cenach i dostępności”, Polska).
4. Wgraj build: `eas submit -p ios` — trafi do TestFlight.
5. **TestFlight**: zainstaluj na iPhonie, zrób zrzuty ekranu (SKLEPY.md).
6. **Strona appki**: teksty, zrzuty, prywatność (App Privacy), klasyfikacja
   wiekowa, dane kontaktowe i notatka dla recenzenta z SKLEPY.md.
7. Wybierz build i **Wyślij do sprawdzenia**.

## 10. Po publikacji

1. Wpisz prawdziwe linki do sklepów:
   - `apps/web/src/content/links.ts` (`storeLinks`) i oficjalne grafiki
     „Pobierz z App Store / Google Play” w
     `apps/web/src/components/landing/store-buttons.tsx` (wymóg wytycznych
     marketingowych Apple i Google),
   - `apps/mobile/src/update/store-url.ts` (`STORE_URLS.ios` — link
     `https://apps.apple.com/app/id<numer>` z App Store Connect).
2. Każda nowa wersja: `version` w `apps/mobile/app.json` (np. 1.0.1), numer
   buildu podbija EAS sam. Gdy stara wersja ma przestać działać, podnieś
   `MIN_APP_VERSION` na hostingu — starsze appki pokażą „Zaktualizuj aplikację”.
3. Przed każdą recenzją odśwież dane konta recenzentów:
   `pnpm db:showcase -- --reset`.
4. Zaglądaj do Sentry, opinii w sklepach i skrzynki kontaktowej.
