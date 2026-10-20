import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { Linking, Platform } from "react-native";

import { CONTACT_EMAIL, LEGAL_URLS, supportMailUrl } from "../src/support/support";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { readRepoFile } from "./helpers/read-repo-file";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

// Builds carry app.json in expo-constants; Jest has no build, so the test gives it a version.
jest.mock("expo-constants", () => {
  const actual = jest.requireActual<{ default: object }>("expo-constants");
  return {
    ...actual,
    __esModule: true,
    default: { ...actual.default, expoConfig: { version: "9.9.9" } },
  };
});

beforeEach(resetSecureStore);

const openURL = jest.spyOn(Linking, "openURL");
beforeEach(() => {
  openURL.mockResolvedValue(true);
});

const appVersion = "9.9.9";

describe("supportMailUrl", () => {
  it("adres, temat i wersje w treści — bez danych finansowych", () => {
    const url = supportMailUrl({ appVersion: "1.2.3", os: "android", osVersion: "36" });

    expect(url.startsWith("mailto:kontakt@finso.app?")).toBe(true);
    const params = new URLSearchParams(url.slice(url.indexOf("?") + 1));
    expect(params.get("subject")).toBe("Finso — zgłoszenie problemu");
    expect(params.get("body")).toBe(
      [
        "Opisz, co się stało:",
        "",
        "",
        "",
        "—",
        "Wersja aplikacji: 1.2.3",
        "System: Android 36",
        "Nie wpisuj kwot ani innych danych finansowych — nie są potrzebne.",
      ].join("\n"),
    );
  });

  it("iOS nazwany po swojemu", () => {
    const url = supportMailUrl({ appVersion: "1.2.3", os: "ios", osVersion: "19.1" });

    expect(new URLSearchParams(url.slice(url.indexOf("?") + 1)).get("body")).toContain(
      "System: iOS 19.1",
    );
  });
});

describe("adresy stron zgadzają się ze stroną web", () => {
  it("kontakt, polityka prywatności i regulamin", () => {
    const site = readRepoFile("apps/web/src/content/site.ts");
    const links = readRepoFile("apps/web/src/content/links.ts");

    expect(site).toContain(`contactEmail = "${CONTACT_EMAIL}"`);
    expect(site).toContain('siteUrl = "https://finso.app"');
    expect(LEGAL_URLS).toEqual({
      privacy: "https://finso.app/polityka-prywatnosci",
      terms: "https://finso.app/regulamin",
    });
    expect(links).toContain('privacy: "/polityka-prywatnosci"');
    expect(links).toContain('terms: "/regulamin"');
  });
});

describe("Ustawienia → Pomoc i informacje", () => {
  async function openSettings() {
    await renderApp("/settings", { signedIn: true });
    await screen.findByRole("header", { name: "Ustawienia" });
  }

  it("„Zgłoś problem” otwiera e-mail z wersją appki i systemu", async () => {
    await openSettings();

    await fireEvent.press(await screen.findByRole("button", { name: "Zgłoś problem" }));

    expect(openURL).toHaveBeenCalledWith(
      supportMailUrl({ appVersion, os: Platform.OS, osVersion: String(Platform.Version) }),
    );
  });

  it("bez aplikacji poczty: pokazuje adres", async () => {
    openURL.mockRejectedValueOnce(new Error("No mail app"));
    await openSettings();

    await fireEvent.press(await screen.findByRole("button", { name: "Zgłoś problem" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Nie znaleziono aplikacji poczty. Napisz na kontakt@finso.app.",
      );
    });
  });

  it.each([
    ["Polityka prywatności", "https://finso.app/polityka-prywatnosci"],
    ["Regulamin", "https://finso.app/regulamin"],
  ])("„%s” otwiera stronę w przeglądarce", async (name, url) => {
    await openSettings();

    await fireEvent.press(await screen.findByRole("button", { name }));

    expect(openURL).toHaveBeenCalledWith(url);
  });

  it("wersja appki widoczna na dole", async () => {
    await openSettings();

    expect(await screen.findByText(`Finso ${appVersion}`)).toBeOnTheScreen();
  });
});
