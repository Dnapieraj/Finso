import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi, seedFakeServer, testGoal } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", " ");

/** 1000 zł of 4000 zł; testBudget plans 500 zł for it this period. */
const trip = testGoal();

const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};
const type = async (label: string, text: string) => {
  await fireEvent.changeText(await screen.findByLabelText(label), text);
};

async function openGoal() {
  const app = await renderApp("/goals", { signedIn: true });
  await screen.findByRole("header", { name: "Cele" });
  await press("Wakacje");
  await screen.findByRole("header", { name: "Edytuj cel" });
  return app;
}

it("says how much of this period's instalment is already paid in", async () => {
  await openGoal();

  expect(
    await screen.findByText(zl("W tym okresie wpłacono 0,00 zł z 500,00 zł")),
  ).toBeOnTheScreen();
  expect(await screen.findByText("Nie ma jeszcze wpłat.")).toBeOnTheScreen();
});

it("a deposit is saved, listed, and the saved-so-far field follows it", async () => {
  await openGoal();

  await type("Kwota wpłaty", "200");
  await press("Wpłać");

  await waitFor(() => {
    expect(fakeApi.goalDeposits.create).toHaveBeenCalledWith({
      input: { goalId: trip.id, amount: 20_000 },
      idempotencyKey: expect.any(String) as unknown,
    });
  });
  expect(await screen.findByText(zl("Wpłacono 200,00 zł."))).toBeOnTheScreen();
  expect(screen.getByLabelText("Kwota wpłaty")).toHaveDisplayValue("");
  expect(await screen.findByText(zl("200,00 zł"))).toBeOnTheScreen();
  await waitFor(() => {
    expect(screen.getByLabelText("Już odłożone")).toHaveDisplayValue("1200");
  });
});

it("two deposits of the same amount are two deposits, each with its own key", async () => {
  await openGoal();

  await type("Kwota wpłaty", "50");
  await press("Wpłać");
  await screen.findByText(zl("Wpłacono 50,00 zł."));
  await type("Kwota wpłaty", "50");
  await press("Wpłać");

  await waitFor(() => {
    expect(fakeApi.goalDeposits.create).toHaveBeenCalledTimes(2);
  });
  const [first, second] = fakeApi.goalDeposits.create.mock.calls.map(([draft]) => draft);
  expect(first?.idempotencyKey).not.toBe(second?.idempotencyKey);
});

it("a retry after a failed deposit sends the same key — one deposit, however many tries", async () => {
  fakeApi.goalDeposits.create.mockRejectedValueOnce(
    new ApiError("network", null, "Network request failed"),
  );
  await openGoal();

  await type("Kwota wpłaty", "200");
  await press("Wpłać");
  expect(await screen.findByText("Nie udało się wpłacić. Spróbuj ponownie.")).toBeOnTheScreen();
  await press("Wpłać");

  await waitFor(() => {
    expect(fakeApi.goalDeposits.create).toHaveBeenCalledTimes(2);
  });
  const [first, second] = fakeApi.goalDeposits.create.mock.calls.map(([draft]) => draft);
  expect(second?.idempotencyKey).toBe(first?.idempotencyKey);
});

it("checks the amount before asking the API", async () => {
  await openGoal();

  await press("Wpłać");

  expect(await screen.findByText("Podaj kwotę.")).toBeOnTheScreen();
  expect(fakeApi.goalDeposits.create).not.toHaveBeenCalled();
});

it("a deposit can be removed and brought back with Cofnij", async () => {
  seedFakeServer({
    goals: [{ ...trip, currentAmount: 120_000 }],
    deposits: [{ id: "dep-1", goalId: trip.id, amount: 20_000, date: "2026-09-15" }],
  });
  await openGoal();

  await press(zl("Usuń wpłatę 200,00 zł z 15 września"));

  await waitFor(() => {
    expect(fakeApi.goalDeposits.remove).toHaveBeenCalledWith(trip.id, "dep-1");
  });
  expect(await screen.findByText(zl("Usunięto wpłatę 200,00 zł."))).toBeOnTheScreen();
  expect(await screen.findByText("Nie ma jeszcze wpłat.")).toBeOnTheScreen();

  await press("Cofnij");

  await waitFor(() => {
    expect(fakeApi.goalDeposits.restore).toHaveBeenCalledWith(trip.id, "dep-1");
  });
  expect(await screen.findByText(zl("200,00 zł"))).toBeOnTheScreen();
});

it("saving the form after a deposit keeps the deposit (the field is not sent unchanged)", async () => {
  const app = await openGoal();

  await type("Kwota wpłaty", "200");
  await press("Wpłać");
  await screen.findByText(zl("Wpłacono 200,00 zł."));
  await waitFor(() => {
    expect(screen.getByLabelText("Już odłożone")).toHaveDisplayValue("1200");
  });
  await type("Nazwa", "Wakacje w Grecji");
  await press("Zapisz");

  await waitFor(() => {
    expect(app).toHavePathname("/goals");
  });
  expect(fakeApi.goals.update).toHaveBeenCalledWith(trip.id, { name: "Wakacje w Grecji" });
});

it("shows an error with a retry when the history does not load", async () => {
  // A 404 is not retried automatically (a dropped connection would be), so the error shows at once.
  fakeApi.goalDeposits.list.mockRejectedValueOnce(new ApiError("http", 404, "Not Found"));
  await openGoal();

  expect(await screen.findByText("Nie udało się wczytać wpłat.")).toBeOnTheScreen();
  await press("Spróbuj ponownie");
  expect(await screen.findByText("Nie ma jeszcze wpłat.")).toBeOnTheScreen();
});
