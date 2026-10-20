import { act, fireEvent, screen } from "expo-router/testing-library";
import { Linking, Platform } from "react-native";

import { STORE_URLS } from "../src/update/store-url";
import { updateRequired } from "../src/update/store";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { readRepoFile } from "./helpers/read-repo-file";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(() => {
  resetSecureStore();
  updateRequired.reset();
});

const openURL = jest.spyOn(Linking, "openURL");
beforeEach(() => {
  openURL.mockResolvedValue(true);
});

it("426 z API: cała appka ustępuje ekranowi „Zaktualizuj aplikację”", async () => {
  await renderApp("/", { signedIn: true });
  await screen.findByRole("header", { name: "Twój budżet" });

  await act(async () => {
    updateRequired.set();
    await Promise.resolve();
  });

  expect(await screen.findByRole("header", { name: "Zaktualizuj aplikację" })).toBeOnTheScreen();
  expect(screen.queryByRole("header", { name: "Twój budżet" })).toBeNull();
  expect(
    screen.getByText(
      "Ta wersja Finso nie jest już obsługiwana. Zaktualizuj aplikację w sklepie — twoje dane czekają na koncie.",
    ),
  ).toBeOnTheScreen();
});

it("także przed zalogowaniem", async () => {
  await renderApp("/login", { signedIn: false });
  await screen.findByRole("header", { name: "Zaloguj się" });

  await act(async () => {
    updateRequired.set();
    await Promise.resolve();
  });

  expect(await screen.findByRole("header", { name: "Zaktualizuj aplikację" })).toBeOnTheScreen();
});

it("„Otwórz sklep” prowadzi do sklepu tego systemu", async () => {
  updateRequired.set();
  await renderApp("/", { signedIn: true });

  await fireEvent.press(await screen.findByRole("button", { name: "Otwórz sklep" }));

  expect(openURL).toHaveBeenCalledWith(
    Platform.OS === "android" ? STORE_URLS.android : STORE_URLS.ios,
  );
});

it("adres Google Play używa identyfikatora appki z app.json", () => {
  const appJson = JSON.parse(readRepoFile("apps/mobile/app.json")) as {
    expo: { android: { package: string } };
  };

  expect(STORE_URLS.android).toBe(
    `https://play.google.com/store/apps/details?id=${appJson.expo.android.package}`,
  );
});
