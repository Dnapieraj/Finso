import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { Linking } from "react-native";

import { fakeApi, seedFakeServer, testDue, testRule } from "./helpers/fake-api";
import {
  answerDialogWith,
  cancelAllScheduledNotificationsAsync,
  requestPermissionsAsync,
  scheduled,
  setPermission,
  tapNotification,
} from "./helpers/fake-notifications";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

/** formatMoney puts a no-break space before "zł"; no other space is special. */
const zl = (text: string) => text.replaceAll(" zł", "\u00A0zł");

// Only the clock is fake: 28.09 at 8:00, the day testBudget is computed for,
// an hour before reminders fire. Timers stay real for the rendering.
beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(2026, 8, 28, 8, 0),
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
beforeEach(resetSecureStore);

const rentToday = testRule({ dayOfMonth: 28 });
const dueRent = testDue({ id: rentToday.id, occurrenceDate: "2026-09-28" });

/** Default reminder texts: no amounts on the lock screen. */
const SALARY = "Wpływ do potwierdzenia: Wypłata";
const RENT = "Masz płatność do potwierdzenia: Czynsz";

const bodies = () => scheduled().map((n) => n.content.body);
const button = (name: string) => screen.findByRole("button", { name });
const press = async (name: string) => {
  await fireEvent.press(await button(name));
};

async function openDashboard() {
  const app = await renderApp("/", { signedIn: true });
  await screen.findByRole("header", { name: "Twój budżet" });
  return app;
}

async function openNotificationSettings() {
  await renderApp("/", { signedIn: true });
  await fireEvent.press(await findTab("Ustawienia"));
  await press("Powiadomienia");
  await screen.findByRole("header", { name: "Powiadomienia" });
}

describe("zgoda: pytanie po pierwszej odpowiedzi na kartę", () => {
  const ask = "Przypominać w dniu wypłaty i płatności?";

  it("przed pierwszą odpowiedzią appka o nic nie pyta", async () => {
    seedFakeServer({ due: [dueRent], rules: [rentToday] });
    await openDashboard();

    await button("Tak: Czynsz");
    expect(screen.queryByText(ask)).not.toBeOnTheScreen();
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("po odpowiedzi pyta we własnym okienku, a systemowe okno dopiero po „Tak, przypominaj”", async () => {
    seedFakeServer({ due: [dueRent], rules: [rentToday] });
    await openDashboard();

    await press("Tak: Czynsz");

    expect(await screen.findByText(ask)).toBeOnTheScreen();
    expect(requestPermissionsAsync).not.toHaveBeenCalled();

    await press("Tak, przypominaj");

    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(bodies()).toContain(SALARY);
    });
    expect(screen.queryByText(ask)).not.toBeOnTheScreen();
  });

  it("„Nie teraz”: bez systemowego okna i bez ponownego pytania", async () => {
    const second = testDue({
      id: "01923b6e-0000-7000-8000-000000000043",
      label: "Internet",
      occurrenceDate: "2026-09-28",
    });
    seedFakeServer({ due: [dueRent, second], rules: [rentToday] });
    await openDashboard();

    await press("Tak: Czynsz");
    await press("Nie teraz");
    await press("Tak: Internet");

    expect(screen.queryByText(ask)).not.toBeOnTheScreen();
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(scheduled()).toEqual([]);
  });

  it("„Nie teraz” pamięta też po ponownym uruchomieniu", async () => {
    const internet = testDue({
      id: "01923b6e-0000-7000-8000-000000000043",
      label: "Internet",
      occurrenceDate: "2026-09-05",
      overdue: true,
    });
    seedFakeServer({ due: [dueRent, internet], rules: [rentToday] });
    await openDashboard();
    await press("Tak: Czynsz");
    await press("Nie teraz");

    await openDashboard();
    await press("Tak: Internet");

    expect(screen.queryByText(ask)).not.toBeOnTheScreen();
  });

  it("zgoda już dana: nie pyta, od razu planuje", async () => {
    setPermission("granted");
    seedFakeServer({ due: [dueRent], rules: [rentToday] });
    await openDashboard();

    await press("Tak: Czynsz");

    expect(screen.queryByText(ask)).not.toBeOnTheScreen();
    await waitFor(() => {
      expect(bodies()).toContain(SALARY);
    });
  });

  it("odmowa w systemowym oknie: nic nie planuje, okienko znika", async () => {
    answerDialogWith("denied");
    seedFakeServer({ due: [dueRent], rules: [rentToday] });
    await openDashboard();

    await press("Tak: Czynsz");
    await press("Tak, przypominaj");

    await waitFor(() => {
      expect(screen.queryByText(ask)).not.toBeOnTheScreen();
    });
    expect(scheduled()).toEqual([]);
  });
});

describe("plan przypomnień", () => {
  it("po starcie appki ze zgodą: wypłata i płatności o 9:00 w dniu terminu", async () => {
    setPermission("granted");
    await openDashboard();

    await waitFor(() => {
      expect(scheduled()).toHaveLength(2);
    });
    expect(scheduled().map((n) => [n.content.title, n.content.body, n.trigger.date])).toEqual([
      ["Stała płatność", RENT, new Date(2026, 9, 5, 9, 0)],
      ["Dzień wypłaty", SALARY, new Date(2026, 9, 10, 9, 0)],
    ]);
  });

  it("bez zgody nic nie planuje", async () => {
    await openDashboard();
    await waitFor(() => {
      expect(fakeApi.recurringRules.list).toHaveBeenCalled();
    });

    expect(scheduled()).toEqual([]);
  });

  it("odpowiedź na kartę przelicza plan: dzisiejsze pytanie znika, zaległe dochodzą", async () => {
    setPermission("granted");
    seedFakeServer({ due: [dueRent], rules: [rentToday] });
    await openDashboard();
    await waitFor(() => {
      expect(scheduled()[0]?.trigger.date).toEqual(new Date(2026, 8, 28, 9, 0));
    });

    await press("Jeszcze nie: Czynsz");

    await waitFor(() => {
      expect(scheduled()[0]?.trigger.date).toEqual(new Date(2026, 8, 29, 9, 0));
    });
    expect(scheduled()[0]?.content.body).toBe("1 pozycja czeka na odpowiedź.");
  });

  it("wylogowanie usuwa zaplanowane przypomnienia — z kwotami, na cudzym telefonie", async () => {
    setPermission("granted");
    await openDashboard();
    await waitFor(() => {
      expect(scheduled()).not.toEqual([]);
    });

    await fireEvent.press(await findTab("Ustawienia"));
    await press("Wyloguj się");

    await waitFor(() => {
      expect(scheduled()).toEqual([]);
    });
    expect(cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });

  it("tapnięcie w przypomnienie otwiera Dashboard", async () => {
    setPermission("granted");
    const app = await renderApp("/history", { signedIn: true });
    await waitFor(() => {
      expect(scheduled()).not.toEqual([]);
    });

    tapNotification(scheduled()[0]?.identifier ?? "");

    await waitFor(() => {
      expect(app).toHavePathname("/");
    });
  });
});

describe("Ustawienia → Powiadomienia", () => {
  const switches = ["Dzień wypłaty", "Stałe płatności", "Zaległe pozycje"];

  it("trzy przełączniki, domyślnie włączone", async () => {
    setPermission("granted");
    await openNotificationSettings();

    for (const name of switches) {
      expect(await screen.findByRole("switch", { name })).toBeChecked();
    }
  });

  it("wyłączenie „Stałe płatności” zostawia wypłatę i jest pamiętane na urządzeniu", async () => {
    setPermission("granted");
    await openNotificationSettings();

    await fireEvent(
      await screen.findByRole("switch", { name: "Stałe płatności" }),
      "valueChange",
      false,
    );

    await waitFor(() => {
      expect(bodies()).toEqual([SALARY]);
    });

    // The app closed and opened again: only the device storage remains.
    await screen.unmount();
    await openNotificationSettings();
    expect(await screen.findByRole("switch", { name: "Stałe płatności" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Dzień wypłaty" })).toBeChecked();
  });

  it("bez decyzji o zgodzie: włączenie przełącznika prosi o nią", async () => {
    await openNotificationSettings();

    await fireEvent(
      await screen.findByRole("switch", { name: "Dzień wypłaty" }),
      "valueChange",
      true,
    );

    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(bodies()).toContain(SALARY);
    });
  });

  it("bez decyzji o zgodzie przełączniki są wyłączone", async () => {
    await openNotificationSettings();

    for (const name of switches) {
      expect(await screen.findByRole("switch", { name })).not.toBeChecked();
    }
  });

  it("zablokowane w systemie: mówi o tym, prowadzi do ustawień telefonu, przełączniki nieaktywne", async () => {
    setPermission("denied");
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    await openNotificationSettings();

    expect(
      await screen.findByText("Powiadomienia są wyłączone w ustawieniach telefonu."),
    ).toBeOnTheScreen();
    for (const name of switches) {
      expect(screen.getByRole("switch", { name })).toBeDisabled();
    }

    await press("Otwórz ustawienia telefonu");
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it("„Pokazuj kwoty w powiadomieniach”: domyślnie wyłączone", async () => {
    setPermission("granted");
    await openNotificationSettings();

    expect(
      await screen.findByRole("switch", { name: "Pokazuj kwoty w powiadomieniach" }),
    ).not.toBeChecked();
    expect(screen.getByText("Powiadomienia widać na zablokowanym ekranie.")).toBeOnTheScreen();
  });

  it("włączenie kwot zmienia treść zaplanowanych przypomnień i jest pamiętane", async () => {
    setPermission("granted");
    await openNotificationSettings();

    await fireEvent(
      await screen.findByRole("switch", { name: "Pokazuj kwoty w powiadomieniach" }),
      "valueChange",
      true,
    );

    await waitFor(() => {
      expect(bodies()).toEqual([
        zl("Czynsz 1500 zł — zapłacone?"),
        zl("Wypłata 5000 zł — wpłynęło?"),
      ]);
    });

    await screen.unmount();
    await openNotificationSettings();
    expect(
      await screen.findByRole("switch", { name: "Pokazuj kwoty w powiadomieniach" }),
    ).toBeChecked();
  });

  it("zablokowane w systemie: przełącznik kwot też nieaktywny", async () => {
    setPermission("denied");
    await openNotificationSettings();

    expect(
      await screen.findByRole("switch", { name: "Pokazuj kwoty w powiadomieniach" }),
    ).toBeDisabled();
  });

  it("mówi, o której przychodzą przypomnienia", async () => {
    setPermission("granted");
    await openNotificationSettings();

    expect(await screen.findByText("Przypomnienia przychodzą o 9:00.")).toBeOnTheScreen();
  });
});
