import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import {
  fakeApi,
  pending,
  seedFakeServer,
  testCategory,
  testConfirmed,
  testDetected,
} from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

/**
 * Network errors and 5xx are retried twice (src/query-client.ts), so a
 * section only shows its error once all three attempts have failed.
 */
function failAllAttempts(mock: jest.Mock, error: Error) {
  mock.mockRejectedValueOnce(error).mockRejectedValueOnce(error).mockRejectedValueOnce(error);
}
const AFTER_RETRIES = { timeout: 5000 };

const spotify = testDetected();
const netflix = testConfirmed();

const header = (name: string) => screen.findByRole("header", { name });
const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};

async function openSubscriptions() {
  const app = await renderApp("/settings/subscriptions", { signedIn: true });
  await header("Subskrypcje");
  return app;
}

describe("ekran Subskrypcje", () => {
  it("Ustawienia → Subskrypcje, w części Budżet", async () => {
    const app = await renderApp("/", { signedIn: true });
    await fireEvent.press(await findTab("Ustawienia"));

    await press("Subskrypcje");

    expect(app).toHavePathname("/settings/subscriptions");
  });

  it("suma główna tylko z potwierdzonych, wykryte osobno", async () => {
    seedFakeServer({ detected: [spotify], confirmedSubscriptions: [netflix] });

    await openSubscriptions();

    expect(await screen.findByText(`${zl("49 zł")}/mies. = ${zl("588 zł")}/rok`)).toBeOnTheScreen();
    expect(screen.getByText(`+ 1 do sprawdzenia: ${zl("23 zł")}/mies.`)).toBeOnTheScreen();
  });

  it("koszty zaokrąglone w górę do pełnych złotych", async () => {
    seedFakeServer({
      confirmedSubscriptions: [testConfirmed({ monthly: 5_725, yearly: 68_700 })],
    });

    await openSubscriptions();

    expect(await screen.findByText(`${zl("58 zł")}/mies. = ${zl("687 zł")}/rok`)).toBeOnTheScreen();
  });

  it("bez potwierdzonych mówi to wprost, wykryte dalej osobno", async () => {
    seedFakeServer({ detected: [spotify] });

    await openSubscriptions();

    expect(
      await screen.findByText("Nie masz jeszcze potwierdzonych subskrypcji."),
    ).toBeOnTheScreen();
    expect(screen.getByText(`+ 1 do sprawdzenia: ${zl("23 zł")}/mies.`)).toBeOnTheScreen();
  });

  it("wykryta pozycja: kwota, jak często, koszt miesięczny i roczny, daty", async () => {
    seedFakeServer({ detected: [spotify] });

    await openSubscriptions();

    const item = within(await screen.findByTestId(`detected-${spotify.key}`));
    expect(item.getByText("Spotify")).toBeOnTheScreen();
    expect(item.getByText(`${zl("23,00 zł")} · co miesiąc`)).toBeOnTheScreen();
    expect(item.getByText(`${zl("23 zł")}/mies. · ${zl("276 zł")}/rok`)).toBeOnTheScreen();
    expect(
      item.getByText("Ostatnio 10 września, następna około 10 października"),
    ).toBeOnTheScreen();
  });

  it("wydatki bez notatki nazywa kategorią", async () => {
    seedFakeServer({ detected: [testDetected({ name: null, key: "a|x|2300" })] });
    fakeApi.categories.list.mockResolvedValueOnce([testCategory]);

    await openSubscriptions();

    const item = within(await screen.findByTestId("detected-a|x|2300"));
    expect(await item.findByText("Jedzenie")).toBeOnTheScreen();
  });

  it("podwyżka: stara i nowa cena, od kiedy i ile więcej rocznie", async () => {
    seedFakeServer({
      detected: [
        testDetected({
          amount: 2_700,
          priceChange: { from: 2_300, to: 2_700, since: "2026-09-10", yearlyDelta: 4_800 },
        }),
      ],
    });

    await openSubscriptions();

    expect(
      await screen.findByText(
        `Cena wzrosła: ${zl("23,00 zł")} → ${zl("27,00 zł")} od 10 września, +${zl("48,00 zł")} rocznie`,
      ),
    ).toBeOnTheScreen();
  });

  it("obniżka u potwierdzonej subskrypcji", async () => {
    seedFakeServer({
      confirmedSubscriptions: [
        testConfirmed({
          priceChange: { from: 4_900, to: 4_300, since: "2026-09-05", yearlyDelta: -7_200 },
        }),
      ],
    });

    await openSubscriptions();

    expect(
      await screen.findByText(
        `Cena spadła: ${zl("49,00 zł")} → ${zl("43,00 zł")} od 5 września, −${zl("72,00 zł")} rocznie`,
      ),
    ).toBeOnTheScreen();
  });

  it("potwierdzona subskrypcja: kwota, rytm i koszt; dotknięcie otwiera stałą płatność", async () => {
    seedFakeServer({ confirmedSubscriptions: [netflix] });

    const app = await openSubscriptions();

    const row = within(await screen.findByRole("button", { name: "Netflix" }));
    expect(row.getByText(`${zl("49,00 zł")} · co miesiąc`)).toBeOnTheScreen();
    expect(row.getByText(`${zl("49 zł")}/mies. · ${zl("588 zł")}/rok`)).toBeOnTheScreen();
    await press("Netflix");
    expect(app).toHavePathname(`/settings/commitments/${netflix.ruleId}`);
  });

  it("co 2 tygodnie i co rok w słowach", async () => {
    seedFakeServer({
      confirmedSubscriptions: [
        testConfirmed({ ruleId: "r1", name: "Basen", frequency: "WEEKLY", interval: 2 }),
        testConfirmed({ ruleId: "r2", name: "Domena", frequency: "YEARLY" }),
      ],
    });

    await openSubscriptions();

    expect(await screen.findByText(`${zl("49,00 zł")} · co 2 tygodnie`)).toBeOnTheScreen();
    expect(screen.getByText(`${zl("49,00 zł")} · co rok`)).toBeOnTheScreen();
  });

  it("pusto: wyjaśnia, skąd biorą się podpowiedzi", async () => {
    await openSubscriptions();

    expect(await screen.findByText(/Finso nie znalazło jeszcze subskrypcji/)).toBeOnTheScreen();
  });

  it("podczas wczytywania: szkielet", async () => {
    fakeApi.subscriptions.overview.mockReturnValueOnce(pending());

    await openSubscriptions();

    expect(screen.getByLabelText("Wczytywanie subskrypcji")).toBeOnTheScreen();
  });

  it("błąd wczytywania z możliwością ponowienia", async () => {
    failAllAttempts(fakeApi.subscriptions.overview, new ApiError("network", null, "offline"));

    await openSubscriptions();

    expect(
      await screen.findByText("Nie udało się wczytać subskrypcji.", {}, AFTER_RETRIES),
    ).toBeOnTheScreen();
    await press("Spróbuj ponownie");
    expect(await screen.findByText(/Finso nie znalazło jeszcze subskrypcji/)).toBeOnTheScreen();
  });
});

describe("„To subskrypcja”", () => {
  it("zamienia w stałą płatność, mówi od kiedy liczy się w budżecie, przenosi do potwierdzonych", async () => {
    seedFakeServer({ detected: [spotify] });
    await openSubscriptions();
    const budgetCalls = fakeApi.budget.current.mock.calls.length;

    await press("To subskrypcja: Spotify");

    expect(fakeApi.subscriptions.confirm).toHaveBeenCalledWith({
      input: { key: spotify.key, name: "Spotify" },
      idempotencyKey: expect.any(String) as unknown,
    });
    expect(
      await screen.findByText(
        "Spotify jest teraz stałą płatnością. Od 10 października Finso odlicza ją z budżetu.",
      ),
    ).toBeOnTheScreen();
    expect(await screen.findByRole("button", { name: "Spotify" })).toBeOnTheScreen();
    expect(screen.queryByTestId(`detected-${spotify.key}`)).toBeNull();
    await waitFor(() => {
      expect(fakeApi.budget.current.mock.calls.length).toBeGreaterThan(budgetCalls);
    });
  });

  it("wydatki bez notatki dostają nazwę kategorii", async () => {
    seedFakeServer({ detected: [testDetected({ name: null, key: "a|x|2300" })] });
    await openSubscriptions();

    await press("To subskrypcja: Jedzenie");

    expect(fakeApi.subscriptions.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ input: { key: "a|x|2300", name: "Jedzenie" } }),
    );
  });

  it("błąd zapisu: komunikat, pozycja zostaje", async () => {
    seedFakeServer({ detected: [spotify] });
    fakeApi.subscriptions.confirm.mockRejectedValueOnce(new ApiError("http", 500, "boom"));
    await openSubscriptions();

    await press("To subskrypcja: Spotify");

    expect(await screen.findByText("Nie udało się zapisać. Spróbuj ponownie.")).toBeOnTheScreen();
    expect(screen.getByTestId(`detected-${spotify.key}`)).toBeOnTheScreen();
  });
});

describe("„To nie subskrypcja”", () => {
  it("ukrywa pozycję na stałe, a „Cofnij” ją przywraca", async () => {
    seedFakeServer({ detected: [spotify] });
    await openSubscriptions();

    await press("To nie subskrypcja: Spotify");

    expect(fakeApi.subscriptions.dismiss).toHaveBeenCalledWith(spotify.key);
    expect(
      await screen.findByText("Ukryto: Spotify. Finso nie będzie już tego podpowiadać."),
    ).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.queryByTestId(`detected-${spotify.key}`)).toBeNull();
    });

    await press("Cofnij");

    expect(fakeApi.subscriptions.undismiss).toHaveBeenCalledWith(spotify.key);
    expect(await screen.findByTestId(`detected-${spotify.key}`)).toBeOnTheScreen();
  });
});

describe("karta na Dashboardzie", () => {
  async function openDashboard() {
    await renderApp("/", { signedIn: true });
    await header("Twój budżet");
  }

  it("pokazuje się, gdy są wykryte pozycje, i prowadzi do ekranu Subskrypcje", async () => {
    seedFakeServer({
      detected: [spotify, testDetected({ key: "n|x|tidal", name: "Tidal" })],
    });
    await openDashboard();

    expect(await header("Wykryte subskrypcje")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Te płatności powtarzają się regularnie: Spotify, Tidal. Czy to subskrypcje?",
      ),
    ).toBeOnTheScreen();
  });

  it("„Sprawdź” otwiera ekran Subskrypcje", async () => {
    seedFakeServer({ detected: [spotify] });
    const app = await renderApp("/", { signedIn: true });
    await header("Wykryte subskrypcje");

    await press("Sprawdź subskrypcje");

    expect(app).toHavePathname("/settings/subscriptions");
  });

  it("bez wykrytych — brak karty (same potwierdzone też jej nie pokazują)", async () => {
    seedFakeServer({ confirmedSubscriptions: [netflix] });
    await openDashboard();
    await waitFor(() => {
      expect(fakeApi.subscriptions.overview).toHaveBeenCalled();
    });

    expect(screen.queryByRole("header", { name: "Wykryte subskrypcje" })).toBeNull();
  });

  it("błąd wczytywania nie zasłania Dashboardu — karta się po prostu nie pokazuje", async () => {
    failAllAttempts(fakeApi.subscriptions.overview, new ApiError("network", null, "offline"));
    await openDashboard();

    expect(await screen.findByText("Możesz wydać")).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Wykryte subskrypcje" })).toBeNull();
  });
});
