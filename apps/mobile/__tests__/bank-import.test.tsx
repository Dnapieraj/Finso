import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen } from "expo-router/testing-library";

import { fakeApi } from "./helpers/fake-api";
import { getDocumentAsync, pickFile } from "./helpers/fake-document-picker";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", " ");

const header = (name: string) => screen.findByRole("header", { name });
const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};

/**
 * mBank-like statement: three expenses (one, 45,90 zł on 27.09, is already
 * in Finso — the fake server's expense), a salary and a payment in euro.
 */
const statement = [
  "#Data operacji;#Opis operacji;#Kwota;",
  "2026-09-27;ZAKUPY BIEDRONKA;-45,90 PLN;",
  "2026-09-28;KINO;-38,00 PLN;",
  "2026-09-30;APTEKA;-1 266,00 PLN;",
  "2026-09-29;WYNAGRODZENIE;5 000,00 PLN;",
  "2026-09-29;HOTEL;-20,00 EUR;",
].join("\n");

async function openImport() {
  const app = await renderApp("/settings/import", { signedIn: true });
  await header("Import z banku");
  return app;
}

describe("Ustawienia → Import z banku", () => {
  it("w części Budżet, obok eksportu", async () => {
    const app = await renderApp("/", { signedIn: true });
    await fireEvent.press(await findTab("Ustawienia"));

    await press("Import z banku");

    expect(app).toHavePathname("/settings/import");
  });

  it("mówi, skąd wziąć plik i co się stanie z powtórzonymi wydatkami", async () => {
    await openImport();

    expect(
      screen.getByText(
        "Wydatki, które już są w Finso (ta sama data i kwota), nie zostaną dodane drugi raz. Kategorie przypiszesz potem w Historii.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Wybierz plik CSV" })).toBeOnTheScreen();
  });
});

describe("podgląd", () => {
  it("ile wydatków, z jakiego okresu, razem ile — i co pominięto", async () => {
    await openImport();
    pickFile("historia.csv", statement);

    await press("Wybierz plik CSV");

    expect(
      await screen.findByText(
        zl("W pliku: 3 wydatki z okresu 27 września 2026 – 30 września 2026, razem 1349,90 zł."),
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText("Pominięte: 1 wpływ, 1 w obcej walucie.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Importuj 3 wydatki" })).toBeOnTheScreen();
    expect(fakeApi.transactions.importRows).not.toHaveBeenCalled();
  });

  it("anulowany wybór pliku niczego nie zmienia", async () => {
    await openImport();

    await press("Wybierz plik CSV");

    expect(getDocumentAsync).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Wybierz plik CSV" })).toBeOnTheScreen();
  });

  it("plik, który nie jest wyciągiem: mówi to wprost", async () => {
    await openImport();
    pickFile("notatki.csv", "Imię;Nazwisko\nOla;Kowalska");

    await press("Wybierz plik CSV");

    expect(
      await screen.findByText("Nie znaleziono kolumn z datą i kwotą. Czy to wyciąg CSV z banku?"),
    ).toBeOnTheScreen();
  });

  it("same wpływy: nie ma czego importować", async () => {
    await openImport();
    pickFile("wplywy.csv", "Data;Opis;Kwota\n2026-09-29;Pensja;5000,00");

    await press("Wybierz plik CSV");

    expect(await screen.findByText("W pliku nie ma wydatków w złotówkach.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Importuj/ })).toBeNull();
  });

  it("za dużo wierszy naraz: prosi o krótszy okres", async () => {
    await openImport();
    const rows = Array.from({ length: 2_001 }, () => "2026-09-28;Kawa;-1,00");
    pickFile("duzo.csv", ["Data;Opis;Kwota", ...rows].join("\n"));

    await press("Wybierz plik CSV");

    expect(
      await screen.findByText(
        "W pliku jest za dużo wydatków. Wybierz w banku krótszy okres — najwyżej 2000 naraz.",
      ),
    ).toBeOnTheScreen();
  });

  it("plik w Windows-1250 (polskie znaki z eksportu banku)", async () => {
    await openImport();
    // „Data;Opis;Kwota\n2026-09-28;Żabka;-5,00” z „Ż” = 0xAF.
    const head = new TextEncoder().encode("Data;Opis;Kwota\n2026-09-28;");
    const tail = new TextEncoder().encode("abka;-5,00");
    pickFile("1250.csv", new Uint8Array([...head, 0xaf, ...tail]));
    await press("Wybierz plik CSV");

    await press("Importuj 1 wydatek");

    expect(fakeApi.transactions.importRows).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { rows: [{ date: "2026-09-28", amount: 500, note: "Żabka" }] },
      }),
    );
  });
});

describe("import", () => {
  it("zapisuje, mówi ile dodano i ile już było, prowadzi do historii", async () => {
    const app = await openImport();
    pickFile("historia.csv", statement);
    await press("Wybierz plik CSV");

    await press("Importuj 3 wydatki");

    expect(
      await screen.findByText("Zaimportowano 2 wydatki. 1 był już w Finso."),
    ).toBeOnTheScreen();
    await press("Otwórz historię");
    expect(app).toHavePathname("/history");
  });

  it("nowe wydatki od razu zmieniają budżet na Starcie", async () => {
    await openImport();
    pickFile("historia.csv", statement);
    await press("Wybierz plik CSV");
    await press("Importuj 3 wydatki");
    await screen.findByText("Zaimportowano 2 wydatki. 1 był już w Finso.");

    await fireEvent.press(await findTab("Start"));

    expect(await screen.findByText(zl("KINO"))).toBeOnTheScreen();
  });

  it("błąd zapisu: komunikat, a ponowienie używa tego samego klucza (bez dubli)", async () => {
    await openImport();
    pickFile("historia.csv", statement);
    await press("Wybierz plik CSV");
    fakeApi.transactions.importRows.mockRejectedValueOnce(
      new ApiError("http", 500, "Internal Server Error"),
    );

    await press("Importuj 3 wydatki");
    expect(
      await screen.findByText("Nie udało się zaimportować. Spróbuj ponownie."),
    ).toBeOnTheScreen();
    await press("Importuj 3 wydatki");

    expect(
      await screen.findByText("Zaimportowano 2 wydatki. 1 był już w Finso."),
    ).toBeOnTheScreen();
    const [first, second] = fakeApi.transactions.importRows.mock.calls.map(
      ([draft]) => draft.idempotencyKey,
    );
    expect(second).toBe(first);
  });
});
