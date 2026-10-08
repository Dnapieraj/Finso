import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { session } from "../src/session";
import { moveAppTo, resetAppState } from "./helpers/app-state";
import {
  answerPromptWith,
  authenticateAsync,
  finishHeldPrompt,
  holdNextPrompt,
  resetLocalAuthentication,
  SecurityLevel,
  setEnrolledLevel,
} from "./helpers/fake-local-authentication";
import { previewHidden, previewVisible, resetScreenCapture } from "./helpers/fake-screen-capture";
import { getItemAsync, resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));
jest.mock("expo-local-authentication", () => require("./helpers/fake-local-authentication"));
jest.mock("expo-screen-capture", () => require("./helpers/fake-screen-capture"));

/** formatMoney puts a no-break space before "zł"; testBudget leaves 1234 zł. */
const AMOUNT = "1234 zł";
const LOCKED = "Finso jest zablokowane";
const LOCK_SWITCH = "Blokada aplikacji";

// Only the clock is fake: the minute in the background is measured with Date.now().
beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 8, 12, 0),
    doNotFake: [
      "nextTick",
      "setImmediate",
      "clearImmediate",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "hrtime",
      "performance",
    ],
  });
});
afterEach(() => {
  jest.useRealTimers();
});
beforeEach(() => {
  resetSecureStore();
  resetLocalAuthentication();
  resetScreenCapture();
  resetAppState();
});

const button = (name: string) => screen.findByRole("button", { name });
const press = async (name: string) => {
  await fireEvent.press(await button(name));
};
const lockSwitch = () => screen.findByRole("switch", { name: LOCK_SWITCH });

async function openLockSettings() {
  await renderApp("/", { signedIn: true });
  await fireEvent.press(await findTab("Ustawienia"));
  await press("Blokada aplikacji");
  await screen.findByRole("header", { name: "Blokada aplikacji" });
}

/** Turns the lock on through the settings, then starts the app again. */
async function enableLockAndRestart() {
  await openLockSettings();
  await fireEvent(await lockSwitch(), "valueChange", true);
  await waitFor(async () => {
    expect(await lockSwitch()).toBeChecked();
  });
  authenticateAsync.mockClear();
  await renderApp("/", { signedIn: true });
}

async function unlock() {
  await waitFor(() => {
    expect(screen.getByText(AMOUNT)).toBeOnTheScreen();
  });
}

describe("Ustawienia → Blokada aplikacji", () => {
  it("domyślnie wyłączona; wiersz w Ustawieniach to mówi", async () => {
    await renderApp("/", { signedIn: true });
    await fireEvent.press(await findTab("Ustawienia"));

    expect(await button("Blokada aplikacji")).toHaveTextContent(/Wyłączona/);

    await press("Blokada aplikacji");
    expect(await lockSwitch()).not.toBeChecked();
    expect(authenticateAsync).not.toHaveBeenCalled();
  });

  it("opisuje, co robi, i że Finso dostaje od telefonu tylko „udało się / nie udało”", async () => {
    await openLockSettings();

    expect(
      screen.getByText(
        "Przy otwarciu i po minucie w tle Finso poprosi o odcisk palca, twarz albo kod telefonu.",
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Sprawdza je telefon. Finso dostaje tylko odpowiedź, czy się udało — nie widzi odcisku ani twarzy.",
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Gdy blokada jest włączona, podgląd Finso w ostatnich aplikacjach jest zasłonięty, a zrzuty ekranu są puste.",
      ),
    ).toBeOnTheScreen();
  });

  it("włączenie wymaga udanego odblokowania — sprawdza, że działa, zanim zamknie drzwi", async () => {
    await openLockSettings();

    await fireEvent(await lockSwitch(), "valueChange", true);

    expect(authenticateAsync).toHaveBeenCalledTimes(1);
    await waitFor(async () => {
      expect(await lockSwitch()).toBeChecked();
    });
    expect(await getItemAsync("app-lock")).toBe("on");
    expect(previewHidden()).toBe(true);
  });

  it("anulowane odblokowanie przy włączaniu — blokada zostaje wyłączona", async () => {
    answerPromptWith("user_cancel");
    await openLockSettings();

    await fireEvent(await lockSwitch(), "valueChange", true);

    await waitFor(() => {
      expect(authenticateAsync).toHaveBeenCalledTimes(1);
    });
    expect(await lockSwitch()).not.toBeChecked();
    expect(await getItemAsync("app-lock")).toBeNull();
    expect(previewVisible()).toBe(true);
  });

  it("zapasowo kod telefonu (systemowy), bez własnego PIN-u w Finso", async () => {
    await openLockSettings();

    await fireEvent(await lockSwitch(), "valueChange", true);

    expect(authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: "Odblokuj Finso", disableDeviceFallback: false }),
    );
  });

  it("sam kod blokady ekranu, bez biometrii — da się włączyć", async () => {
    setEnrolledLevel(SecurityLevel.SECRET);
    await openLockSettings();

    await fireEvent(await lockSwitch(), "valueChange", true);

    await waitFor(async () => {
      expect(await lockSwitch()).toBeChecked();
    });
  });

  it("telefon bez biometrii i bez kodu — przełącznik nieaktywny i wyjaśnienie dlaczego", async () => {
    setEnrolledLevel(SecurityLevel.NONE);
    await openLockSettings();

    expect(await lockSwitch()).toBeDisabled();
    expect(
      screen.getByText(
        "Telefon nie ma ustawionej blokady ekranu. Ustaw w nim kod, odcisk palca albo rozpoznawanie twarzy, a potem wróć tutaj.",
      ),
    ).toBeOnTheScreen();
    expect(authenticateAsync).not.toHaveBeenCalled();
  });

  it("wyłączenie nie pyta o odblokowanie (appka i tak jest otwarta) i odsłania podgląd", async () => {
    await openLockSettings();
    await fireEvent(await lockSwitch(), "valueChange", true);
    await waitFor(async () => {
      expect(await lockSwitch()).toBeChecked();
    });
    authenticateAsync.mockClear();

    await fireEvent(await lockSwitch(), "valueChange", false);

    await waitFor(async () => {
      expect(await lockSwitch()).not.toBeChecked();
    });
    expect(authenticateAsync).not.toHaveBeenCalled();
    expect(await getItemAsync("app-lock")).toBeNull();
    expect(previewVisible()).toBe(true);
  });
});

describe("przy otwarciu appki", () => {
  it("blokada wyłączona — appka otwiera się od razu, bez pytania", async () => {
    await renderApp("/", { signedIn: true });

    await unlock();
    expect(authenticateAsync).not.toHaveBeenCalled();
    expect(previewVisible()).toBe(true);
  });

  it("blokada włączona — kwoty zasłonięte, systemowe okno samo się pokazuje, po sukcesie Dashboard", async () => {
    holdNextPrompt();
    await enableLockAndRestart();

    expect(await screen.findByText(LOCKED)).toBeOnTheScreen();
    expect(screen.queryByText(AMOUNT)).not.toBeOnTheScreen();
    expect(authenticateAsync).toHaveBeenCalledTimes(1);
    expect(previewHidden()).toBe(true);

    finishHeldPrompt("success");

    await unlock();
    expect(screen.queryByText(LOCKED)).not.toBeOnTheScreen();
  });

  it("anulowane okno — zostaje zablokowana, „Odblokuj” pyta ponownie", async () => {
    answerPromptWith("user_cancel");
    await enableLockAndRestart();

    expect(await screen.findByText(LOCKED)).toBeOnTheScreen();
    expect(screen.queryByText(AMOUNT)).not.toBeOnTheScreen();

    await press("Odblokuj");

    expect(authenticateAsync).toHaveBeenCalledTimes(2);
    await unlock();
  });

  it("zablokowana appka pozwala się wylogować — wyjście, gdy odblokowanie nie działa", async () => {
    answerPromptWith("user_cancel");
    await enableLockAndRestart();
    await screen.findByText(LOCKED);

    await press("Wyloguj się");

    expect(await screen.findByRole("header", { name: "Zaloguj się" })).toBeOnTheScreen();
    expect(await getItemAsync("app-lock")).toBeNull();
  });

  it("telefon stracił blokadę ekranu po włączeniu — appka otwiera się, wyłącza blokadę i mówi dlaczego", async () => {
    await enableLockAndRestart();
    setEnrolledLevel(SecurityLevel.NONE);

    await renderApp("/", { signedIn: true });

    await unlock();
    expect(
      screen.getByText(
        "Blokada aplikacji jest wyłączona, bo telefon nie ma już ustawionej blokady ekranu.",
      ),
    ).toBeOnTheScreen();
    expect(await getItemAsync("app-lock")).toBeNull();
  });
});

describe("po powrocie z tła", () => {
  async function unlockedWithLockOn() {
    await enableLockAndRestart();
    await unlock();
    authenticateAsync.mockClear();
  }

  it("w tle i w przełączniku appek zawartość jest zasłonięta", async () => {
    await unlockedWithLockOn();

    await moveAppTo("inactive");
    expect(screen.queryByText(AMOUNT)).not.toBeOnTheScreen();

    await moveAppTo("background");
    expect(screen.queryByText(AMOUNT)).not.toBeOnTheScreen();
  });

  it("po krótkiej chwili (30 s) — od razu tam, gdzie użytkownik był", async () => {
    await unlockedWithLockOn();

    await moveAppTo("background");
    jest.advanceTimersByTime(30_000);
    await moveAppTo("active");

    await unlock();
    expect(authenticateAsync).not.toHaveBeenCalled();
  });

  it("po minucie — blokada i systemowe okno", async () => {
    await unlockedWithLockOn();
    holdNextPrompt();

    await moveAppTo("background");
    jest.advanceTimersByTime(60_000);
    await moveAppTo("active");

    expect(await screen.findByText(LOCKED)).toBeOnTheScreen();
    expect(screen.queryByText(AMOUNT)).not.toBeOnTheScreen();
    expect(authenticateAsync).toHaveBeenCalledTimes(1);

    finishHeldPrompt("success");
    await unlock();
  });

  it("przełącznik appek na chwilę (iOS: tylko „inactive”) nie blokuje", async () => {
    await unlockedWithLockOn();

    await moveAppTo("inactive");
    jest.advanceTimersByTime(120_000);
    await moveAppTo("active");

    await unlock();
    expect(authenticateAsync).not.toHaveBeenCalled();
  });

  it("ekran kodu telefonu (Android: osobne okno, appka „w tle”) nie wywołuje drugiej blokady", async () => {
    await unlockedWithLockOn();
    await moveAppTo("background");
    jest.advanceTimersByTime(60_000);
    holdNextPrompt();
    await moveAppTo("active");
    await screen.findByText(LOCKED);

    // The user picks "Use PIN": Android opens its own screen over the app.
    await moveAppTo("background");
    jest.advanceTimersByTime(90_000);
    await moveAppTo("active");
    finishHeldPrompt("success");

    await unlock();
    expect(authenticateAsync).toHaveBeenCalledTimes(1);
  });

  it("blokada wyłączona — tło niczego nie zasłania i nie blokuje", async () => {
    await renderApp("/", { signedIn: true });
    await unlock();

    await moveAppTo("background");
    jest.advanceTimersByTime(600_000);
    await moveAppTo("active");

    await unlock();
    expect(authenticateAsync).not.toHaveBeenCalled();
  });
});

describe("wylogowanie wyłącza blokadę", () => {
  it("„Wyloguj się” w Ustawieniach — blokada wyłączona, podgląd odsłonięty, logowanie bez pytania", async () => {
    await enableLockAndRestart();
    await unlock();
    await fireEvent.press(await findTab("Ustawienia"));

    await press("Wyloguj się");

    expect(await screen.findByRole("header", { name: "Zaloguj się" })).toBeOnTheScreen();
    expect(await getItemAsync("app-lock")).toBeNull();
    expect(previewVisible()).toBe(true);
  });

  it.each(["expired", "deleted"] as const)(
    "koniec sesji z innego powodu (%s) też ją wyłącza",
    async (reason) => {
      await enableLockAndRestart();
      await unlock();

      await session.signedOut(reason);

      await waitFor(async () => {
        expect(await getItemAsync("app-lock")).toBeNull();
      });
      expect(previewVisible()).toBe(true);
    },
  );

  it("wylogowany użytkownik nigdy nie widzi ekranu blokady", async () => {
    await enableLockAndRestart();
    await unlock();
    await session.signedOut("logout");
    authenticateAsync.mockClear();

    await renderApp("/", { signedIn: false });

    expect(await screen.findByRole("header", { name: "Zaloguj się" })).toBeOnTheScreen();
    expect(screen.queryByText(LOCKED)).not.toBeOnTheScreen();
    expect(authenticateAsync).not.toHaveBeenCalled();
  });
});
