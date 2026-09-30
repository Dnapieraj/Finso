import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi, pending } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

async function openPayday() {
  const app = await renderApp("/settings/payday", { signedIn: true });
  await screen.findByRole("header", { name: "Dzień wypłaty" });
  return app;
}

it("has the current payday selected", async () => {
  await openPayday();

  expect(screen.getByRole("radio", { name: "10" })).toBeSelected();
  expect(screen.queryByRole("radio", { name: "29" })).not.toBeOnTheScreen();
  expect(screen.getByText("Dostajesz ją 29., 30. lub 31.? Wybierz 28.")).toBeOnTheScreen();
});

it("saves a new payday and returns to settings, which show it", async () => {
  const app = await openPayday();

  await fireEvent.press(screen.getByRole("radio", { name: "25" }));
  await fireEvent.press(screen.getByRole("button", { name: "Zapisz" }));

  await waitFor(() => {
    expect(app).toHavePathname("/settings");
  });
  expect(fakeApi.users.updateMe).toHaveBeenCalledWith({ periodStartDay: 25 });
  expect(await screen.findByText("25. dnia miesiąca")).toBeOnTheScreen();
});

it("an unchanged payday returns without asking the API", async () => {
  const app = await openPayday();

  await fireEvent.press(screen.getByRole("button", { name: "Zapisz" }));

  await waitFor(() => {
    expect(app).toHavePathname("/settings");
  });
  expect(fakeApi.users.updateMe).not.toHaveBeenCalled();
});

it("blocks a second tap while saving", async () => {
  fakeApi.users.updateMe.mockReturnValueOnce(pending());
  await openPayday();
  await fireEvent.press(screen.getByRole("radio", { name: "25" }));

  await fireEvent.press(screen.getByRole("button", { name: "Zapisz" }));
  const button = await screen.findByRole("button", { name: "Zapisywanie…" });

  expect(button).toBeDisabled();
  await fireEvent.press(button);
  expect(fakeApi.users.updateMe).toHaveBeenCalledTimes(1);
});

it("a failed save says why and keeps the choice", async () => {
  fakeApi.users.updateMe.mockRejectedValueOnce(
    new ApiError("network", null, "Network request failed"),
  );
  const app = await openPayday();
  await fireEvent.press(screen.getByRole("radio", { name: "25" }));

  await fireEvent.press(screen.getByRole("button", { name: "Zapisz" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
  );
  expect(app).toHavePathname("/settings/payday");
  expect(screen.getByRole("radio", { name: "25" })).toBeSelected();
});

it("Wstecz leaves without saving", async () => {
  const app = await openPayday();
  await fireEvent.press(screen.getByRole("radio", { name: "25" }));

  await fireEvent.press(screen.getByRole("button", { name: "Wstecz" }));

  await waitFor(() => {
    expect(app).toHavePathname("/settings");
  });
  expect(fakeApi.users.updateMe).not.toHaveBeenCalled();
});
