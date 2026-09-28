import { fireEvent, screen } from "expo-router/testing-library";

import { fakeApi } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({ api: jest.requireActual("./helpers/fake-api").fakeApi }));

beforeEach(resetSecureStore);

const SCREENS = [
  ["/login", "Zaloguj się"],
  ["/register", "Załóż konto"],
] as const;

async function open(path: string, title: string) {
  await renderApp(path, { signedIn: false });
  await screen.findByRole("header", { name: title });
}

it.each(SCREENS)("%s shows the Finso wordmark above the form", async (path, title) => {
  await open(path, title);

  expect(screen.getByText("Finso")).toBeOnTheScreen();
});

// Apple first: App Store guideline 4.8 wants Sign in with Apple at least as
// prominent as the other providers.
it.each(SCREENS)("%s offers Apple and Google, Apple first", async (path, title) => {
  await open(path, title);

  const apple = screen.getByRole("button", { name: "Kontynuuj z Apple" });
  const google = screen.getByRole("button", { name: "Kontynuuj z Google" });
  const buttons = screen.getAllByRole("button");
  expect(buttons.indexOf(apple)).toBeLessThan(buttons.indexOf(google));
  expect(screen.getByText("lub")).toBeOnTheScreen();
});

it.each([
  ["Apple", "Logowanie przez Apple będzie dostępne wkrótce."],
  ["Google", "Logowanie przez Google będzie dostępne wkrótce."],
] as const)(
  "until it works, %s says it is coming soon and calls no API",
  async (provider, message) => {
    await open("/login", "Zaloguj się");

    await fireEvent.press(screen.getByRole("button", { name: `Kontynuuj z ${provider}` }));

    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(fakeApi.auth.login).not.toHaveBeenCalled();
    expect(fakeApi.auth.register).not.toHaveBeenCalled();
  },
);
