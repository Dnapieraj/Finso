import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import { devicePreferences } from "../src/preferences/device-preferences";
import {
  billsCategory,
  fakeApi,
  pending,
  seedFakeServer,
  testCategory,
  testTransaction,
} from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(() => {
  resetSecureStore();
  fakeApi.categories.list.mockResolvedValue([testCategory, billsCategory]);
});
afterEach(() => {
  fakeApi.categories.list.mockResolvedValue([testCategory]);
});

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", " ");

const header = (name: string) => screen.findByRole("header", { name });
const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};
const type = async (label: string, text: string) => {
  await fireEvent.changeText(screen.getByLabelText(label), text);
};

/** Food: 800 zł a period. The fake server's one expense is 45,90 zł on food (27.09). */
const foodLimit = { categoryId: testCategory.id, amount: 80_000 };

async function openList() {
  const app = await renderApp("/settings/limits", { signedIn: true });
  await header("Limity kategorii");
  return app;
}

describe("Ustawienia → Limity kategorii", () => {
  it("w części Budżet", async () => {
    const app = await renderApp("/", { signedIn: true });
    await fireEvent.press(await findTab("Ustawienia"));

    await press("Limity kategorii");

    expect(app).toHavePathname("/settings/limits");
  });

  it("każdy limit: kategoria, ile zostało z ilu i ile dziennie", async () => {
    seedFakeServer({ limits: [foodLimit] });

    await openList();

    // 754,10 zł na 12 dni (28.09–9.10) → 62,84 zł → 62 zł.
    const row = within(await screen.findByRole("button", { name: "Jedzenie" }));
    expect(row.getByText(zl("Zostało 754 zł z 800 zł · 62 zł dziennie"))).toBeOnTheScreen();
  });

  it("przekroczony: o ile, w górę", async () => {
    seedFakeServer({ limits: [{ categoryId: testCategory.id, amount: 4_000 }] });

    await openList();

    const row = within(await screen.findByRole("button", { name: "Jedzenie" }));
    expect(row.getByText(zl("Ponad limit o 6 zł (limit 40 zł)"))).toBeOnTheScreen();
  });

  it("skeleton podczas wczytywania", async () => {
    fakeApi.categoryLimits.overview.mockReturnValueOnce(pending());

    await openList();

    expect(screen.getByLabelText("Wczytywanie limitów")).toBeOnTheScreen();
  });

  it("błąd z ponowieniem", async () => {
    seedFakeServer({ limits: [foodLimit] });
    fakeApi.categoryLimits.overview.mockRejectedValueOnce(
      new ApiError("invalid-response", 200, "Response does not match the schema"),
    );
    await openList();

    expect(await screen.findByText("Nie udało się wczytać limitów.")).toBeOnTheScreen();
    await press("Spróbuj ponownie");

    expect(await screen.findByRole("button", { name: "Jedzenie" })).toBeOnTheScreen();
  });

  it("pusty stan mówi, do czego służą", async () => {
    await openList();

    expect(
      await screen.findByText(
        "Nie masz jeszcze limitów. Ustaw np. jedzenie do 800 zł na okres — Start pokaże, ile zostało.",
      ),
    ).toBeOnTheScreen();
  });

  it("dodaje limit: kategoria i kwota na okres", async () => {
    await openList();
    await press("Dodaj limit");
    await header("Nowy limit");

    await fireEvent.press(await screen.findByRole("radio", { name: "Rachunki" }));
    await type("Limit na okres", "300");
    await press("Zapisz");

    await header("Limity kategorii");
    expect(fakeApi.categoryLimits.set).toHaveBeenCalledWith(billsCategory.id, { amount: 30_000 });
    expect(await screen.findByRole("button", { name: "Rachunki" })).toBeOnTheScreen();
  });

  it("nowy limit: bez kategorii i bez kwoty nie zapisze", async () => {
    await openList();
    await press("Dodaj limit");
    await header("Nowy limit");

    await press("Zapisz");

    expect(await screen.findByText("Wybierz kategorię.")).toBeOnTheScreen();
    expect(screen.getByText("Podaj kwotę.")).toBeOnTheScreen();
    expect(fakeApi.categoryLimits.set).not.toHaveBeenCalled();
  });

  it("nowy limit: kategorie, które już mają limit, nie są do wyboru", async () => {
    seedFakeServer({ limits: [foodLimit] });
    await openList();
    await press("Dodaj limit");
    await header("Nowy limit");

    expect(await screen.findByRole("radio", { name: "Rachunki" })).toBeOnTheScreen();
    expect(screen.queryByRole("radio", { name: "Jedzenie" })).toBeNull();
  });

  it("zmienia kwotę istniejącego limitu", async () => {
    seedFakeServer({ limits: [foodLimit] });
    await openList();
    await press("Jedzenie");
    await header("Limit: Jedzenie");

    await type("Limit na okres", "650");
    await press("Zapisz");

    await header("Limity kategorii");
    expect(fakeApi.categoryLimits.set).toHaveBeenCalledWith(testCategory.id, { amount: 65_000 });
  });

  it("usuwa limit po potwierdzeniu; wydatki zostają", async () => {
    seedFakeServer({ limits: [foodLimit] });
    await openList();
    await press("Jedzenie");
    await header("Limit: Jedzenie");

    await press("Usuń limit");
    expect(await screen.findByText("Wydatki w tej kategorii zostaną.")).toBeOnTheScreen();
    await press("Usuń");

    await header("Limity kategorii");
    expect(fakeApi.categoryLimits.remove).toHaveBeenCalledWith(testCategory.id);
  });
});

describe("Start: limity", () => {
  it("bez limitów — nic", async () => {
    await renderApp("/", { signedIn: true });
    await screen.findByText("Możesz wydać");

    await waitFor(() => {
      expect(fakeApi.categoryLimits.overview).toHaveBeenCalled();
    });
    expect(screen.queryByRole("header", { name: "Limity" })).toBeNull();
  });

  it("każdy limit z tym, ile zostało; dotknięcie otwiera jego ustawienia", async () => {
    seedFakeServer({ limits: [foodLimit] });
    const app = await renderApp("/", { signedIn: true });

    expect(await header("Limity")).toBeOnTheScreen();
    const row = await screen.findByRole("button", { name: /^Limit: Jedzenie/ });
    expect(within(row).getByText(zl("Zostało 754 zł z 800 zł · 62 zł dziennie"))).toBeOnTheScreen();

    await fireEvent.press(row);
    expect(app).toHavePathname(`/settings/limits/${testCategory.id}`);
  });

  it("nowy wydatek w kategorii od razu zmienia „zostało”", async () => {
    seedFakeServer({ limits: [foodLimit] });
    await renderApp("/", { signedIn: true });
    await header("Limity");

    await press("Dodaj wydatek");
    await type("Kwota", "54,10");
    await fireEvent.press(await screen.findByRole("button", { name: "Jedzenie" }));

    expect(
      await screen.findByText(zl("Zostało 700 zł z 800 zł · 58 zł dziennie")),
    ).toBeOnTheScreen();
  });

  it("tryb ukrytych kwot ukrywa i limity", async () => {
    seedFakeServer({ limits: [foodLimit] });
    await devicePreferences.set({ hideAmounts: true });
    await renderApp("/", { signedIn: true });

    expect(await screen.findByText("Zostało ••• z ••• · ••• dziennie")).toBeOnTheScreen();
    await devicePreferences.set({ hideAmounts: false });
  });
});

describe("Start: chudszy okres", () => {
  const lean = {
    counted: 300_000,
    typical: 500_000,
    shortfall: 200_000,
    suggestions: [
      { categoryId: testCategory.id, usual: 90_000, suggested: 63_000 },
      { categoryId: billsCategory.id, usual: 30_000, suggested: 21_000 },
    ],
  };

  it("mówi wprost, ile liczymy i ile zwykle wpływa, i podpowiada, co przyciąć", async () => {
    seedFakeServer({ leanMonth: lean });
    await renderApp("/", { signedIn: true });

    expect(await header("Chudszy okres")).toBeOnTheScreen();
    expect(
      screen.getByText(
        zl("Z dochodu nieregularnego liczymy w tym okresie 3000 zł, a zwykle wpływa 5000 zł."),
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText(zl("Jedzenie: zwykle 900 zł, spróbuj 630 zł"))).toBeOnTheScreen();
    expect(screen.getByText(zl("Rachunki: zwykle 300 zł, spróbuj 210 zł"))).toBeOnTheScreen();
  });

  it("„Ustaw limit” zapisuje podpowiedź jako limit; podpowiedź znika, limit się pojawia", async () => {
    seedFakeServer({ leanMonth: lean });
    await renderApp("/", { signedIn: true });
    await header("Chudszy okres");

    await press(zl("Ustaw limit 630 zł dla kategorii Jedzenie"));

    expect(fakeApi.categoryLimits.set).toHaveBeenCalledWith(testCategory.id, { amount: 63_000 });
    await waitFor(() => {
      expect(screen.queryByText(zl("Jedzenie: zwykle 900 zł, spróbuj 630 zł"))).toBeNull();
    });
    expect(await header("Limity")).toBeOnTheScreen();
  });

  it("bez historii wydatków: tylko ostrzeżenie", async () => {
    seedFakeServer({ leanMonth: { ...lean, suggestions: [] } });
    await renderApp("/", { signedIn: true });

    expect(await header("Chudszy okres")).toBeOnTheScreen();
    expect(
      screen.getByText("Za mało historii wydatków, żeby podpowiedzieć, co przyciąć."),
    ).toBeOnTheScreen();
  });

  it("zwykły okres — bez karty", async () => {
    await renderApp("/", { signedIn: true });
    await screen.findByText("Możesz wydać");
    await waitFor(() => {
      expect(fakeApi.categoryLimits.overview).toHaveBeenCalled();
    });

    expect(screen.queryByRole("header", { name: "Chudszy okres" })).toBeNull();
  });
});

describe("kolejne wydatki w poprzednim okresie", () => {
  it("wydatek z poprzedniego okresu nie zjada limitu", async () => {
    seedFakeServer({
      limits: [foodLimit],
      transactions: [testTransaction({ date: "2026-09-05", amount: 70_000 })],
    });

    await openList();

    expect(
      await screen.findByText(zl("Zostało 800 zł z 800 zł · 66 zł dziennie")),
    ).toBeOnTheScreen();
  });
});
