import { theme } from "@vireo/tokens";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";
import { Appearance, StyleSheet } from "react-native";

import { secureTokenStore } from "../src/secure-token-store";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));
// Under Jest NativeWind's vars() returns {}; passing the variables through
// lets the test read what the root of the app sets.
jest.mock("nativewind", () => ({
  ...jest.requireActual<object>("nativewind"),
  vars: (variables: Record<string, string | number>) => variables,
}));

const setColorScheme = jest.spyOn(Appearance, "setColorScheme");

beforeEach(resetSecureStore);

/** The CSS variables at the root of the app: palette and text scale. */
function rootVariables(): Record<string, unknown> {
  return StyleSheet.flatten(screen.getByTestId("app-root").props.style) as Record<string, unknown>;
}

async function openAppearance() {
  await renderApp("/", { signedIn: true });
  await fireEvent.press(await findTab("Ustawienia"));
  await fireEvent.press(await screen.findByRole("button", { name: "Wygląd" }));
  await screen.findByRole("header", { name: "Wygląd" });
}

const group = (name: string) => within(screen.getByRole("radiogroup", { name }));
const choose = async (groupName: string, option: string) => {
  await fireEvent.press(group(groupName).getByRole("radio", { name: option }));
};

describe("Ustawienia → Wygląd", () => {
  it("rozmiar tekstu i motyw, oba domyślnie „Systemowy”", async () => {
    await openAppearance();

    for (const [name, options] of [
      ["Rozmiar tekstu", ["Systemowy", "Duży", "Bardzo duży"]],
      ["Motyw", ["Systemowy", "Jasny", "Ciemny"]],
    ] as const) {
      for (const option of options) {
        const radio = group(name).getByRole("radio", { name: option });
        if (option === "Systemowy") expect(radio).toBeChecked();
        else expect(radio).not.toBeChecked();
      }
    }
    expect(rootVariables()["--text-scale"]).toBe(1);
  });
});

describe("rozmiar tekstu — powiększa tylko tekst, razem z ustawieniem telefonu", () => {
  it.each([
    ["Duży", 1.15],
    ["Bardzo duży", 1.3],
  ] as const)("„%s” → tekst ×%s", async (option, scale) => {
    await openAppearance();

    await choose("Rozmiar tekstu", option);

    await waitFor(() => {
      expect(rootVariables()["--text-scale"]).toBe(scale);
    });
    expect(group("Rozmiar tekstu").getByRole("radio", { name: option })).toBeChecked();
  });

  it("powrót do „Systemowy” → ×1", async () => {
    await openAppearance();
    await choose("Rozmiar tekstu", "Bardzo duży");

    await choose("Rozmiar tekstu", "Systemowy");

    await waitFor(() => {
      expect(rootVariables()["--text-scale"]).toBe(1);
    });
  });
});

describe("motyw", () => {
  it("„Ciemny”: ciemna paleta i ciemne elementy systemowe, mimo jasnego telefonu", async () => {
    await openAppearance();

    await choose("Motyw", "Ciemny");

    await waitFor(() => {
      expect(rootVariables()["--background"]).toBe(theme.colors.dark.background);
    });
    // Switches, the keyboard and the status bar follow the app, not the phone.
    expect(setColorScheme).toHaveBeenLastCalledWith("dark");
  });

  it("„Jasny” i z powrotem „Systemowy”", async () => {
    await openAppearance();

    await choose("Motyw", "Jasny");
    await waitFor(() => {
      expect(setColorScheme).toHaveBeenLastCalledWith("light");
    });
    expect(rootVariables()["--background"]).toBe(theme.colors.light.background);

    await choose("Motyw", "Systemowy");
    await waitFor(() => {
      expect(setColorScheme).toHaveBeenLastCalledWith("unspecified");
    });
  });
});

it("wybór jest zapamiętany na urządzeniu i działa od startu appki", async () => {
  await openAppearance();
  await choose("Rozmiar tekstu", "Bardzo duży");
  await choose("Motyw", "Ciemny");
  await waitFor(() => {
    expect(rootVariables()["--text-scale"]).toBe(1.3);
  });

  // The app closed and opened again: only the device storage remains.
  await screen.unmount();
  setColorScheme.mockClear();
  await renderApp("/", { signedIn: true });
  await screen.findByRole("header", { name: "Twój budżet" });

  expect(rootVariables()["--text-scale"]).toBe(1.3);
  expect(rootVariables()["--background"]).toBe(theme.colors.dark.background);
  expect(setColorScheme).toHaveBeenCalledWith("dark");
});

it("na ekranie logowania (bez sesji) wybór też obowiązuje", async () => {
  await openAppearance();
  await choose("Motyw", "Ciemny");
  await waitFor(() => {
    expect(rootVariables()["--background"]).toBe(theme.colors.dark.background);
  });

  await screen.unmount();
  // Signed out: the session is gone, the appearance stays on the device.
  await secureTokenStore.clear();
  await renderApp("/login", { signedIn: false });
  await screen.findByRole("header", { name: "Zaloguj się" });

  expect(rootVariables()["--background"]).toBe(theme.colors.dark.background);
});

describe("podgląd na żywo", () => {
  /** formatMoney puts a no-break space before "zł". */
  const zl = (text: string) => text.replaceAll(" zł", "\u00A0zł");

  it("próbka budżetu pod wyborem, zmienia się razem z rozmiarem i motywem", async () => {
    await openAppearance();

    const preview = within(screen.getByLabelText("Podgląd"));
    expect(preview.getByText("Możesz wydać")).toBeOnTheScreen();
    expect(preview.getByText(zl("2126 zł"))).toBeOnTheScreen();
    expect(preview.getByText(zl("177 zł dziennie"))).toBeOnTheScreen();

    // Live: the preview is part of the app, so it follows the root at once.
    await choose("Rozmiar tekstu", "Bardzo duży");
    await choose("Motyw", "Ciemny");
    await waitFor(() => {
      expect(rootVariables()["--text-scale"]).toBe(1.3);
    });
    expect(rootVariables()["--background"]).toBe(theme.colors.dark.background);
    expect(screen.getByLabelText("Podgląd")).toBeOnTheScreen();
  });

  it("kwota w podglądzie zachowuje się jak na Dashboardzie: jedna linia, zmniejsza się", async () => {
    await openAppearance();

    const amount = within(screen.getByLabelText("Podgląd")).getByText(zl("2126 zł"));
    expect(amount).toHaveProp("numberOfLines", 1);
    expect(amount).toHaveProp("adjustsFontSizeToFit", true);
  });
});
