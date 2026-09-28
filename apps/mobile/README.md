# mobile

Aplikacja Finso na iOS i Androida: **Expo SDK 57 + Expo Router + NativeWind 4**.
To tutaj powstaje cała funkcjonalność: logowanie, budżet, symulator, cele, ustawienia.
Na razie: logowanie, rejestracja i zakładki Start (logo) oraz Ustawienia (wylogowanie, usuwanie konta).

## Uruchomienie na telefonie

1. Zainstaluj na telefonie aplikację **Expo Go** (App Store / Google Play).
2. Uruchom API na komputerze (instrukcja w [README głównym](../../README.md)).
3. Skopiuj `.env.example` do `.env` i ustaw adres API:

   ```bash
   EXPO_PUBLIC_API_URL=http://192.168.0.106:3000
   ```

   > **Ważne: to musi być adres IP komputera w sieci Wi-Fi, nie `localhost`.**
   > Na telefonie `localhost` oznacza sam telefon, więc aplikacja nie znalazłaby API.
   > Adres IP sprawdzisz poleceniem `ipconfig` (Windows, „Adres IPv4” karty Wi-Fi)
   > albo `ipconfig getifaddr en0` (macOS). Telefon i komputer muszą być w tej samej sieci Wi-Fi.
   >
   > Wyjątki: emulator Androida widzi komputer pod `http://10.0.2.2:3000`,
   > a symulator iOS pod `http://localhost:3000`.

4. Wystartuj serwer deweloperski i zeskanuj kod QR aparatem (iOS) albo w Expo Go (Android):

   ```bash
   pnpm --filter mobile start
   ```

Po zmianie `.env` uruchom serwer ponownie z czyszczeniem cache: `pnpm --filter mobile start --clear`.
Bez poprawnego `EXPO_PUBLIC_API_URL` aplikacja zatrzyma się od razu z komunikatem, co ustawić.

## Jak to jest zbudowane

- `app/` — ekrany (Expo Router: plik = ekran). `_layout.tsx` ładuje fonty, motyw i TanStack Query
  i pilnuje dostępu: `Stack.Protected` wpuszcza do `(app)/` tylko zalogowanych, do `(auth)/` tylko
  niezalogowanych. Zmiana stanu sesji sama przenosi na właściwy ekran i czyści historię „Wstecz”
- `src/session.ts` — stan sesji poza Reactem (`restoring` / `signed-in` / `signed-out` + powód
  wylogowania), bo wygasłą sesję zauważa klient API, nie komponent
- `src/auth/` — hooki logowania/rejestracji/usuwania konta (TanStack Query) i komunikaty błędów API
- `src/forms/error-map.ts` — polskie komunikaty walidacji dla wspólnych schematów Zod z `@vireo/shared`
- `src/components/` — przyciski, pola formularza, alerty
- `src/api.ts` — klient API z `@vireo/shared/api` (typy i walidacja wspólne z backendem)
- `src/secure-token-store.ts` — tokeny sesji w Keychain (iOS) / Keystore (Android) przez `expo-secure-store`
- `src/theme.ts` + `tailwind.config.ts` — kolory z `@vireo/tokens` jako zmienne CSS;
  jasna/ciemna paleta przełącza się razem z motywem systemu
- `src/messages/pl.ts` — wszystkie teksty interfejsu

Style piszesz klasami Tailwinda (`className="bg-card text-foreground"`). NativeWind 4 działa
na **Tailwind 3.4** (web używa Tailwind 4) — nazwy klas są prawie takie same.

## Usuwanie konta — musi zgadzać się ze stroną WWW

Ścieżka Ustawienia → „Usuń konto” → hasło → natychmiastowe usunięcie jest opisana na stronie
`/usuwanie-konta` (wymóg Google Play). Test `__tests__/delete-account.test.tsx` czyta plik strony
i przechodzi ekrany tymi samymi etykietami — zmiana po jednej stronie bez drugiej go wywali.

## Testy

```bash
pnpm --filter mobile test        # Jest (jest-expo) + React Native Testing Library
pnpm --filter mobile typecheck
pnpm --filter mobile lint
```

W RNTL 14 `render` jest asynchroniczne: `await render(<Ekran />)`.
Testy ekranów renderują prawdziwe drzewo `app/` przez `renderApp` (`__tests__/helpers/`), z udawanym
klientem API i secure-store w pamięci. Ścieżkę sprawdzasz przez `expect(app).toHavePathname(...)`,
a zakładki przez `getTab("Ustawienia")`.
CI dodatkowo buduje bundle Androida (`expo export`), żeby wyłapać błędy Metro, których testy nie widzą.

## Uwagi

- Wersje paczek natywnych instaluj przez `pnpm expo install <paczka>` — dobiera wersje zgodne z SDK 57.
- `npx expo-doctor` sprawdza zgodność zależności (obecnie 21/21).
- Mobile nie zależy od `@vireo/ui` (webowy React) — tylko od `@vireo/tokens` i `@vireo/shared`.
