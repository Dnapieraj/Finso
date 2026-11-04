import { screen } from "expo-router/testing-library";

import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

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

// No buttons that do nothing: Apple and Google sign-in come back together
// with the real thing (stage 8, docs/PRODUCT.md) — a dead button would also
// fail App Store review (guideline 2.1).
it.each(SCREENS)(
  "%s has no Apple or Google buttons until they really work",
  async (path, title) => {
    await open(path, title);

    expect(screen.queryByRole("button", { name: "Kontynuuj z Apple" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Kontynuuj z Google" })).toBeNull();
    expect(screen.queryByText("lub")).toBeNull();
  },
);
