import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi, seedFakeServer, testDue } from "./helpers/fake-api";
import { breakHaptics, hapticsFelt } from "./helpers/fake-haptics";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

const LIGHT = "impact:light";
const ERROR = "notification:error";
const SWITCH = "Wibracje";

const networkError = () => new ApiError("network", null, "Network request failed");

const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};
const type = async (label: string, text: string) => {
  await fireEvent.changeText(await screen.findByLabelText(label), text);
};

async function quickAdd(amount = "45,90") {
  await renderApp("/", { signedIn: true });
  await press("Dodaj wydatek");
  await type("Kwota", amount);
  await press("Jedzenie");
}

async function openSettings() {
  await renderApp("/", { signedIn: true });
  await fireEvent.press(await findTab("Ustawienia"));
  return screen.findByRole("switch", { name: SWITCH });
}

describe("lekka wibracja przy zapisie", () => {
  it("szybkie dodanie: od razu przy tapnięciu kategorii", async () => {
    await quickAdd();

    await waitFor(() => {
      expect(hapticsFelt()).toEqual([LIGHT]);
    });
  });

  it("edycja wydatku", async () => {
    await renderApp("/history", { signedIn: true });
    await fireEvent.press(await screen.findByRole("button", { name: /^Jedzenie, 27 września/ }));
    await type("Kwota", "50");

    await press("Zapisz");

    await waitFor(() => {
      expect(hapticsFelt()).toEqual([LIGHT]);
    });
  });

  it("nowy cel", async () => {
    await renderApp("/goals", { signedIn: true });
    await press("Dodaj cel");
    await type("Nazwa", "Rower");
    await type("Kwota docelowa", "3000");
    await fireEvent.press(await screen.findByRole("radio", { name: "Czerwiec" }));
    await press("Następny rok");

    await press("Zapisz");

    await waitFor(() => {
      expect(hapticsFelt()).toEqual([LIGHT]);
    });
  });

  it("odpowiedź na kartę „Do potwierdzenia”", async () => {
    seedFakeServer({ due: [testDue()] });
    await renderApp("/", { signedIn: true });

    await press("Tak: Czynsz");

    await waitFor(() => {
      expect(hapticsFelt()).toEqual([LIGHT]);
    });
  });
});

describe("inna wibracja przy błędzie", () => {
  it("szybkie dodanie, które nie dotarło do serwera: lekka, potem błąd", async () => {
    fakeApi.transactions.create.mockRejectedValueOnce(networkError());

    await quickAdd();

    await screen.findByText(/Nie udało się zapisać wydatku/);
    expect(hapticsFelt()).toEqual([LIGHT, ERROR]);
  });

  it("edycja wydatku, której serwer nie przyjął", async () => {
    fakeApi.transactions.update.mockRejectedValueOnce(networkError());
    await renderApp("/history", { signedIn: true });
    await fireEvent.press(await screen.findByRole("button", { name: /^Jedzenie, 27 września/ }));
    await type("Kwota", "50");

    await press("Zapisz");

    await screen.findByRole("alert");
    expect(hapticsFelt()).toEqual([ERROR]);
  });

  it("formularz z błędami po „Zapisz” (nic nie wysłane)", async () => {
    await renderApp("/goals", { signedIn: true });
    await press("Dodaj cel");

    await press("Zapisz");

    await screen.findByText("Podaj nazwę.");
    expect(hapticsFelt()).toEqual([ERROR]);
    expect(fakeApi.goals.create).not.toHaveBeenCalled();
  });
});

describe("Ustawienia → Wibracje", () => {
  it("domyślnie włączone", async () => {
    expect(await openSettings()).toBeChecked();
  });

  it("wyłączone: zapis i błąd bez wibracji", async () => {
    await fireEvent(await openSettings(), "valueChange", false);
    await screen.unmount();
    fakeApi.transactions.create.mockRejectedValueOnce(networkError());

    await quickAdd();

    await screen.findByText(/Nie udało się zapisać wydatku/);
    expect(hapticsFelt()).toEqual([]);
  });

  it("wybór zapamiętany na urządzeniu", async () => {
    await fireEvent(await openSettings(), "valueChange", false);
    await screen.unmount();

    expect(await openSettings()).not.toBeChecked();
  });
});

it("telefon bez silniczka wibracji: zapis działa jak zwykle", async () => {
  breakHaptics();

  await quickAdd();

  expect(await screen.findByText(/^Zapisano /)).toBeOnTheScreen();
  await waitFor(() => {
    expect(fakeApi.transactions.create).toHaveBeenCalledTimes(1);
  });
});
