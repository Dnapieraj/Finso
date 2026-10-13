import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { seedFakeServer, testDue, testTransaction } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

const HIDDEN = "•••";
const HIDE = "Ukryj kwoty";
const SHOW = "Pokaż kwoty";

/**
 * Every amount the screen shows or reads out: a digit, a space, "zł" (the
 * text query turns the no-break space into a plain one), so "Podaj kwotę
 * w złotych" does not count.
 */
function amountsOnScreen(): string[] {
  const amount = /\d\szł/;
  const texts = screen.queryAllByText(amount).map((node) => String(node.props.children));
  const labels = screen
    .queryAllByLabelText(amount)
    .map((node) => String(node.props.accessibilityLabel));
  return [...texts, ...labels];
}

const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};

async function openDashboard() {
  await renderApp("/", { signedIn: true });
  await screen.findByText(zl("1234 zł"));
}

/** Hides amounts with the eye on the dashboard, then opens `url` by its button or tab. */
async function hideAmounts() {
  await openDashboard();
  await press(HIDE);
  await waitFor(() => {
    expect(amountsOnScreen()).toEqual([]);
  });
}

describe("oko przy „Możesz wydać”", () => {
  it("jedno tapnięcie ukrywa wszystkie kwoty Dashboardu, drugie je pokazuje", async () => {
    await openDashboard();
    expect(amountsOnScreen().length).toBeGreaterThan(0);

    await press(HIDE);

    await waitFor(() => {
      expect(amountsOnScreen()).toEqual([]);
    });
    // The main amount, the daily allowance, goals and recent expenses.
    expect(screen.getAllByText(new RegExp(HIDDEN)).length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(`Dziś możesz wydać ${HIDDEN}`)).toBeOnTheScreen();

    await press(SHOW);

    expect(await screen.findByText(zl("1234 zł"))).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: HIDE })).toBeOnTheScreen();
  });

  it("czytnik ekranu mówi „ukryta kwota”, nie odczytuje kropek", async () => {
    await hideAmounts();

    expect(screen.getByLabelText("Ukryta kwota")).toHaveTextContent(HIDDEN);
    expect(screen.getByLabelText("Jedzenie, 27 września, ukryta kwota")).toBeOnTheScreen();
  });

  it("słowa i procenty zostają: widać, że stać, ile dni i jak daleko do celu", async () => {
    await hideAmounts();

    expect(screen.getByText("Możesz wydać")).toBeOnTheScreen();
    expect(screen.getByText("25%")).toBeOnTheScreen();
    expect(screen.getByText("Dzień 19 z 30")).toBeOnTheScreen();
  });
});

describe("ukryte wszędzie", () => {
  it("Historia: lista i wykres", async () => {
    await hideAmounts();

    await press("Wszystkie wydatki");
    await screen.findByRole("header", { name: "Historia wydatków" });
    await screen.findByRole("button", { name: /^Jedzenie, 27 września/ });

    expect(amountsOnScreen()).toEqual([]);
  });

  it("Cele: odłożone, docelowe i rata", async () => {
    await hideAmounts();

    await fireEvent.press(await findTab("Cele"));
    await screen.findByRole("button", { name: "Wakacje" });

    expect(amountsOnScreen()).toEqual([]);
    expect(screen.getByText(`${HIDDEN} z ${HIDDEN}`)).toBeOnTheScreen();
  });

  it("Symulator: werdykt słowami, kwoty ukryte (wpisywana kwota zostaje widoczna)", async () => {
    await hideAmounts();

    await fireEvent.press(await findTab("Symulator"));
    await fireEvent.changeText(await screen.findByLabelText("Kwota"), "120");
    await fireEvent.press(await screen.findByRole("radio", { name: "Jedzenie" }));

    expect(await screen.findByRole("header", { name: "Stać cię" })).toBeOnTheScreen();
    expect(screen.getByText(`Zostanie ${HIDDEN}`)).toBeOnTheScreen();
    expect(amountsOnScreen()).toEqual([]);
    // What the user is typing is not a secret from them.
    expect(screen.getByLabelText("Kwota")).toHaveDisplayValue("120");
  });

  it("komunikat po szybkim dodaniu wydatku", async () => {
    await hideAmounts();

    await press("Dodaj wydatek");
    await fireEvent.changeText(await screen.findByLabelText("Kwota"), "45,90");
    await press("Jedzenie");

    expect(await screen.findByText(`Zapisano ${HIDDEN} · Jedzenie`)).toBeOnTheScreen();
    expect(amountsOnScreen()).toEqual([]);
  });

  it("karta „Do potwierdzenia”", async () => {
    seedFakeServer({ due: [testDue()] });
    await hideAmounts();

    expect(await screen.findByText(`Czynsz ${HIDDEN} — zapłacone?`)).toBeOnTheScreen();
    expect(amountsOnScreen()).toEqual([]);
  });

  it.each([
    ["Dochody", "/settings/income", "Wypłata"],
    ["Stałe zobowiązania", "/settings/commitments", "Czynsz"],
  ])("Ustawienia → %s", async (title, url, row) => {
    await hideAmounts();
    await screen.unmount();

    await renderApp(url, { signedIn: true });
    await screen.findByRole("header", { name: title });
    await screen.findByRole("button", { name: row });

    expect(amountsOnScreen()).toEqual([]);
  });

  it("edycja wydatku: pole kwoty pokazuje wartość, bo edytuje się ją świadomie", async () => {
    seedFakeServer({ transactions: [testTransaction({ amount: 4_500 })] });
    await hideAmounts();

    await press("Wszystkie wydatki");
    await press("Jedzenie, 27 września, ukryta kwota");
    await screen.findByRole("header", { name: "Edytuj wydatek" });

    expect(screen.getByLabelText("Kwota")).toHaveDisplayValue("45");
  });
});

describe("zapamiętane na urządzeniu", () => {
  it("po ponownym otwarciu appki kwoty są dalej ukryte, od pierwszego widoku", async () => {
    await hideAmounts();

    // The app closed and opened again: only the device storage remains.
    await screen.unmount();
    await renderApp("/", { signedIn: true });
    await screen.findByRole("header", { name: "Twój budżet" });
    await screen.findByLabelText("Ukryta kwota");

    expect(amountsOnScreen()).toEqual([]);
    expect(screen.getByRole("button", { name: SHOW })).toBeOnTheScreen();
  });

  it("domyślnie kwoty są widoczne", async () => {
    await openDashboard();

    expect(screen.getByRole("button", { name: HIDE })).toBeOnTheScreen();
  });
});
