import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import {
  billsCategory,
  fakeApi,
  pending,
  seedFakeServer,
  testCategory,
  testTemplate,
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
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

const coffee = testTemplate();

const header = (name: string) => screen.findByRole("header", { name });
const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};
const choose = async (name: string) => {
  await fireEvent.press(await screen.findByRole("radio", { name }));
};
const type = async (label: string, text: string) => {
  await fireEvent.changeText(screen.getByLabelText(label), text);
};

async function openList() {
  const app = await renderApp("/settings/templates", { signedIn: true });
  await header("Szablony wydatków");
  return app;
}

async function openNew() {
  const app = await openList();
  await press("Dodaj szablon");
  await header("Nowy szablon");
  return app;
}

async function openEdit() {
  const app = await openList();
  await press("Kawa");
  await header("Edytuj szablon");
  return app;
}

describe("lista", () => {
  it("Ustawienia → Szablony wydatków, w części Budżet", async () => {
    const app = await renderApp("/", { signedIn: true });
    await fireEvent.press(await findTab("Ustawienia"));

    await press("Szablony wydatków");

    expect(app).toHavePathname("/settings/templates");
  });

  it("każdy szablon: nazwa, kwota i kategoria", async () => {
    seedFakeServer({ templates: [coffee] });

    await openList();

    const row = within(await screen.findByRole("button", { name: "Kawa" }));
    expect(row.getByText(`${zl("14,00 zł")} · Jedzenie`)).toBeOnTheScreen();
  });

  it("szablon bez kategorii mówi, że trzeba ją wybrać", async () => {
    seedFakeServer({ templates: [testTemplate({ categoryId: null })] });

    await openList();

    const row = within(await screen.findByRole("button", { name: "Kawa" }));
    expect(row.getByText(`${zl("14,00 zł")} · Wybierz kategorię`)).toBeOnTheScreen();
  });

  it("skeleton podczas wczytywania", async () => {
    fakeApi.expenseTemplates.list.mockReturnValueOnce(pending());

    await openList();

    expect(screen.getByLabelText("Wczytywanie szablonów")).toBeOnTheScreen();
  });

  it("błąd z ponowieniem", async () => {
    seedFakeServer({ templates: [coffee] });
    fakeApi.expenseTemplates.list.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    await openList();

    expect(await screen.findByText("Nie udało się wczytać szablonów.")).toBeOnTheScreen();
    await press("Spróbuj ponownie");

    expect(await screen.findByRole("button", { name: "Kawa" })).toBeOnTheScreen();
  });

  it("pusty stan mówi, do czego służą", async () => {
    await openList();

    expect(
      await screen.findByText(
        "Nie masz jeszcze szablonów. Dodaj wydatki, które często powtarzasz, np. kawę — zapiszesz je jednym tapnięciem.",
      ),
    ).toBeOnTheScreen();
  });
});

describe("dodawanie", () => {
  it("zapisuje nazwę, kwotę w groszach i kategorię, wraca do listy", async () => {
    const app = await openNew();
    await type("Nazwa", "Bilet");
    await type("Kwota", "4,80");
    await choose("Rachunki");

    await press("Zapisz");

    await waitFor(() => {
      expect(app).toHavePathname("/settings/templates");
    });
    expect(fakeApi.expenseTemplates.create).toHaveBeenCalledWith({
      name: "Bilet",
      amount: 480,
      categoryId: billsCategory.id,
    });
    expect(await screen.findByRole("button", { name: "Bilet" })).toBeOnTheScreen();
  });

  it("nazwa, kwota i kategoria są wymagane", async () => {
    await openNew();

    await press("Zapisz");

    expect(screen.getByText("Podaj nazwę.")).toBeOnTheScreen();
    expect(screen.getByText("Podaj kwotę.")).toBeOnTheScreen();
    expect(screen.getByText("Wybierz kategorię.")).toBeOnTheScreen();
    expect(fakeApi.expenseTemplates.create).not.toHaveBeenCalled();
  });

  it("nieudany zapis mówi dlaczego i zostaje na formularzu", async () => {
    fakeApi.expenseTemplates.create.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    const app = await openNew();
    await type("Nazwa", "Bilet");
    await type("Kwota", "4,80");
    await choose("Jedzenie");

    await press("Zapisz");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
    );
    expect(app).toHavePathname("/settings/templates/new");
  });
});

describe("edycja", () => {
  beforeEach(() => {
    seedFakeServer({ templates: [coffee] });
  });

  it("otwiera się z obecnymi wartościami", async () => {
    await openEdit();

    expect(screen.getByLabelText("Nazwa")).toHaveDisplayValue("Kawa");
    expect(screen.getByLabelText("Kwota")).toHaveDisplayValue("14");
    expect(await screen.findByRole("radio", { name: "Jedzenie" })).toBeSelected();
  });

  it("wysyła tylko to, co się zmieniło", async () => {
    const app = await openEdit();
    await type("Kwota", "16");

    await press("Zapisz");

    await waitFor(() => {
      expect(app).toHavePathname("/settings/templates");
    });
    expect(fakeApi.expenseTemplates.update).toHaveBeenCalledWith(coffee.id, { amount: 1_600 });
  });

  it("nieznane id mówi to wprost", async () => {
    await renderApp("/settings/templates/01923b6e-0000-7000-8000-00000000dead", {
      signedIn: true,
    });

    expect(await screen.findByText("Nie znaleziono tego szablonu.")).toBeOnTheScreen();
  });
});

describe("usuwanie", () => {
  beforeEach(() => {
    seedFakeServer({ templates: [coffee] });
  });

  it("najpierw pyta i mówi, że zapisane wydatki zostają", async () => {
    await openEdit();

    await press("Usuń szablon");

    expect(screen.getByText("Wydatki zapisane z szablonu zostaną.")).toBeOnTheScreen();
    expect(fakeApi.expenseTemplates.remove).not.toHaveBeenCalled();
  });

  it("usuwa i wraca do listy bez niego", async () => {
    const app = await openEdit();
    await press("Usuń szablon");

    await press("Usuń");

    await waitFor(() => {
      expect(app).toHavePathname("/settings/templates");
    });
    expect(fakeApi.expenseTemplates.remove).toHaveBeenCalledWith(coffee.id);
    expect(await screen.findByText(/Nie masz jeszcze szablonów/)).toBeOnTheScreen();
  });
});
