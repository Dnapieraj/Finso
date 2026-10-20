import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi } from "./helpers/fake-api";
import { writtenFile } from "./helpers/fake-file-system";
import { setSharingAvailable, shareAsync } from "./helpers/fake-sharing";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};

async function openExport() {
  const app = await renderApp("/settings", { signedIn: true });
  await press("Eksport danych");
  await screen.findByRole("header", { name: "Eksport danych" });
  return app;
}

it("Ustawienia → Eksport danych: cztery pliki do wyboru", async () => {
  const app = await openExport();

  expect(app).toHavePathname("/settings/export");
  for (const name of ["Wydatki", "Wpływy", "Cele", "Stałe zobowiązania"]) {
    expect(screen.getByRole("button", { name: `Eksportuj: ${name}` })).toBeOnTheScreen();
  }
});

it("zapisuje świeży plik CSV i otwiera systemowe „Udostępnij”", async () => {
  await openExport();

  await press("Eksportuj: Wydatki");

  const uri = "file:///cache/finso-wydatki-2026-09-28.csv";
  await waitFor(() => {
    expect(shareAsync).toHaveBeenCalledWith(uri, {
      mimeType: "text/csv",
      UTI: "public.comma-separated-values-text",
      dialogTitle: "Wydatki — Finso",
    });
  });
  expect(writtenFile(uri)).toContain("2026-09-27;45,90;Jedzenie;;Zapłacone;;;");
  expect(fakeApi.exportData).toHaveBeenCalledTimes(1);
});

it("każde tapnięcie pobiera dane od nowa — plik zawsze aktualny", async () => {
  await openExport();

  await press("Eksportuj: Cele");
  await waitFor(() => {
    expect(shareAsync).toHaveBeenCalledTimes(1);
  });
  await press("Eksportuj: Cele");

  await waitFor(() => {
    expect(fakeApi.exportData).toHaveBeenCalledTimes(2);
  });
});

it("błąd pobierania danych: komunikat", async () => {
  fakeApi.exportData.mockRejectedValueOnce(new ApiError("http", 500, "boom"));
  await openExport();

  await press("Eksportuj: Wpływy");

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Nie udało się przygotować pliku. Spróbuj ponownie.",
  );
});

it("telefon bez „Udostępnij”: mówi to wprost", async () => {
  setSharingAvailable(false);
  await openExport();

  await press("Eksportuj: Wydatki");

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Na tym urządzeniu nie da się udostępnić pliku.",
  );
  expect(shareAsync).not.toHaveBeenCalled();
});
