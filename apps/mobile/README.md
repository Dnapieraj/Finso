# mobile

Aplikacja Finso na iOS i Androida: **Expo SDK 57 + Expo Router + NativeWind 4**.
To tutaj powstaje cała funkcjonalność: logowanie, budżet, symulator, cele, ustawienia.
Na razie: logowanie, rejestracja i zakładki Start (logo) oraz Ustawienia (wylogowanie, usuwanie konta).

## Uruchomienie — development build (Android)

Od 4.10.2026 appkę uruchamiamy jako **development build**: własną aplikację „Finso” z kodem
natywnym, zamiast Expo Go. Expo Go na Androidzie nie obsługuje `expo-notifications`, a później
nie obsłuży też RevenueCat ani logowania Apple/Google. Katalog `android/` generuje się z
`app.json` przy buildzie i nie trafia do repo (`.gitignore`).

**Raz na komputerze** (Windows, PowerShell; potem zamknij i otwórz terminal):

```powershell
setx JAVA_HOME "C:\Program Files\Android\Android Studio\jbr"
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
# i dopisz do PATH (Ustawienia systemu → Zmienne środowiskowe): %ANDROID_HOME%\platform-tools
```

**Windows + pnpm: nowszy CMake.** Domyślny CMake 3.22 z Android SDK ma ninja, który nie radzi
sobie z długimi ścieżkami pnpm (`build.ninja still dirty after 100 tries` przy
`react-native-worklets`). Zainstaluj CMake 3.31.6 (Android Studio → SDK Manager → SDK Tools →
„Show Package Details” → CMake 3.31.6) i po pierwszym `pnpm --filter mobile android`
(który wygeneruje `android/`) dopisz do `apps/mobile/android/local.properties`:

```properties
cmake.dir=C:/Users/<ty>/AppData/Local/Android/Sdk/cmake/3.31.6
```

`local.properties` jest lokalny (katalog `android/` nie trafia do repo); znika tylko przy
`expo prebuild --clean` — wtedy dopisz go znowu.

**Pierwszy build i po każdej zmianie natywnej:**

```bash
# emulator: Android Studio → Device Manager → ▶ (albo telefon przez USB z debugowaniem)
pnpm --filter mobile android     # = expo run:android: buduje, instaluje „Finso”, ~10–15 min za 1. razem
```

Ponowny build jest potrzebny tylko po: instalacji paczki z kodem natywnym (`expo install …`),
zmianie `app.json` (pluginy, ikona, identyfikatory) albo aktualizacji Expo SDK.

**Na co dzień** (zmiany w JS/TS — bez budowania):

```bash
pnpm --filter mobile start       # Metro dla development buildu; „a” otwiera appkę na emulatorze
```

Appka „Finso” na emulatorze sama łączy się z Metro; zmiany kodu wchodzą od razu (Fast Refresh),
„r” w Metro przeładowuje całość. Expo Go dalej działa do szybkiego podglądu, ale bez powiadomień
na Androidzie. **iPhone:** z Windowsa tylko przez EAS Build w chmurze — plan w `docs/PRODUCT.md`
(etap 8).

## Adres API (`.env`)

1. Uruchom API na komputerze (instrukcja w [README głównym](../../README.md)).
2. Skopiuj `.env.example` do `.env` i ustaw adres API:

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

3. Wystartuj Metro: `pnpm --filter mobile start`.

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
