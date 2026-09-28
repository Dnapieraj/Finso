import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { session } from "../src/session";
import { fakeApi } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { readRepoFile } from "./helpers/read-repo-file";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/**
 * The labels the web page /usuwanie-konta promises. Google Play requires
 * that page to describe the real process, so the UI test below walks
 * exactly these labels, and the first test fails if either side changes.
 */
const PATH = {
  tab: "Ustawienia",
  action: "Usuń konto",
  confirm: "Potwierdź hasłem",
  outcome: "Konto i wszystkie dane zostaną usunięte od razu.",
};

it("matches the steps the web page /usuwanie-konta promises", () => {
  const webPage = readRepoFile("apps/web/src/messages/legal/delete-account.ts");

  expect(webPage).toContain(`przejdź do zakładki ${PATH.tab}.`);
  expect(webPage).toContain(`Wybierz ${PATH.action}.`);
  expect(webPage).toContain(`${PATH.confirm}. ${PATH.outcome}`);
});

async function openDeleteAccount() {
  const app = await renderApp("/", { signedIn: true });
  await fireEvent.press(await findTab(PATH.tab));
  await fireEvent.press(await screen.findByRole("button", { name: PATH.action }));
  await screen.findByRole("header", { name: PATH.action });
  return app;
}

async function confirmWithPassword(password: string) {
  await fireEvent.changeText(screen.getByLabelText("Hasło"), password);
  await fireEvent.press(screen.getByRole("button", { name: "Usuń konto na zawsze" }));
}

it("deletes the account right after password confirmation, as the web page says", async () => {
  const app = await openDeleteAccount();
  expect(screen.getByText(`${PATH.confirm}, że to ty.`)).toBeOnTheScreen();
  expect(screen.getByText(`${PATH.outcome} Tego nie da się cofnąć.`)).toBeOnTheScreen();

  await confirmWithPassword("tajne-haslo-123");

  // No extra dialog: the password is the confirmation, then deletion is immediate.
  await waitFor(() => {
    expect(app).toHavePathname("/login");
  });
  expect(fakeApi.users.deleteMe).toHaveBeenCalledWith({ password: "tajne-haslo-123" });
  expect(screen.getByRole("alert")).toHaveTextContent("Konto i wszystkie dane zostały usunięte.");
  expect(session.getState()).toEqual({ status: "signed-out", signOutReason: "deleted" });
});

it("asks for the password before calling the API", async () => {
  await openDeleteAccount();

  await confirmWithPassword("");

  expect(await screen.findByText("Podaj hasło.")).toBeOnTheScreen();
  expect(fakeApi.users.deleteMe).not.toHaveBeenCalled();
});

it("keeps the account and the session when the password is wrong", async () => {
  fakeApi.users.deleteMe.mockRejectedValueOnce(new ApiError("http", 403, "Invalid password"));
  const app = await openDeleteAccount();

  await confirmWithPassword("zle-haslo");

  expect(await screen.findByRole("alert")).toHaveTextContent("Nieprawidłowe hasło.");
  expect(app).toHavePathname("/settings/delete-account");
  expect(session.getState().status).toBe("signed-in");
});

it("keeps the account when the request fails, and says why", async () => {
  fakeApi.users.deleteMe.mockRejectedValueOnce(
    new ApiError("network", null, "Network request failed"),
  );
  await openDeleteAccount();

  await confirmWithPassword("tajne-haslo-123");

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
  );
  expect(session.getState().status).toBe("signed-in");
});

it("can be abandoned with a cancel button that returns to settings", async () => {
  const app = await openDeleteAccount();

  await fireEvent.press(screen.getByRole("button", { name: "Anuluj" }));

  await waitFor(() => {
    expect(app).toHavePathname("/settings");
  });
  expect(fakeApi.users.deleteMe).not.toHaveBeenCalled();
});
