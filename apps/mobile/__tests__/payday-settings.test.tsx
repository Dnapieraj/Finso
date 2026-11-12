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
  expect(screen.getByRole("radio", { name: "29" })).toBeOnTheScreen();
  expect(screen.getByRole("radio", { name: "31, ostatni dzień miesiąca" })).toBeOnTheScreen();
  expect(
    screen.getByText("29.–31.: w krótszych miesiącach liczymy ostatni dzień miesiąca."),
  ).toBeOnTheScreen();
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

it("payday on the last day of the month: saved as 31, shown in words", async () => {
  const app = await openPayday();

  await fireEvent.press(screen.getByRole("radio", { name: "31, ostatni dzień miesiąca" }));
  await fireEvent.press(screen.getByRole("button", { name: "Zapisz" }));

  await waitFor(() => {
    expect(app).toHavePathname("/settings");
  });
  expect(fakeApi.users.updateMe).toHaveBeenCalledWith({ periodStartDay: 31 });
  expect(await screen.findByText("Ostatni dzień miesiąca")).toBeOnTheScreen();
});
