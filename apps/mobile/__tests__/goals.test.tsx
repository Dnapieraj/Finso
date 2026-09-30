import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import { fakeApi, pending, seedFakeServer, testGoal } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

/** The draft `create` gets: the input with its own Idempotency-Key. */
const withKey = (input: unknown) => ({ input, idempotencyKey: expect.any(String) as unknown });

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

/** 1000 zł of 4000 zł, due June 2027; testBudget plans 500 zł for it this period. */
const trip = testGoal();

const header = (name: string) => screen.findByRole("header", { name });
const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};
const choose = async (name: string) => {
  await fireEvent.press(await screen.findByRole("radio", { name }));
};
const type = async (label: string, text: string) => {
  await fireEvent.changeText(await screen.findByLabelText(label), text);
};

async function openList() {
  const app = await renderApp("/goals", { signedIn: true });
  await header("Cele");
  return app;
}

async function openNew() {
  const app = await openList();
  await press("Dodaj cel");
  await header("Nowy cel");
  return app;
}

async function openEdit(name = "Wakacje") {
  const app = await openList();
  await press(name);
  await header("Edytuj cel");
  return app;
}

/** A bike for 3000 zł by June 2027 (the form starts at the current year, 2026). */
async function fillInBike() {
  await type("Nazwa", "Rower");
  await type("Kwota docelowa", "3000");
  await choose("Czerwiec");
  await press("Następny rok");
}

describe("where", () => {
  it("is a tab of its own, between Start and Symulator", async () => {
    const app = await renderApp("/", { signedIn: true });

    await fireEvent.press(await findTab("Cele"));

    await header("Cele");
    expect(app).toHavePathname("/goals");
  });

  it("the dashboard's goals card leads here", async () => {
    const app = await renderApp("/", { signedIn: true });

    await press("Wszystkie cele");

    await header("Cele");
    expect(app).toHavePathname("/goals");
  });
});

describe("list", () => {
  it("shows each goal: progress, saved of target, deadline and this period's instalment", async () => {
    await openList();

    const row = within(await screen.findByRole("button", { name: "Wakacje" }));
    expect(row.getByRole("progressbar", { name: "Wakacje" })).toHaveAccessibilityValue({
      min: 0,
      max: 100,
      now: 25,
      text: "25%",
    });
    expect(row.getByText(zl("1000 zł z 4000 zł"))).toBeOnTheScreen();
    expect(row.getByText("do czerwca 2027")).toBeOnTheScreen();
    // The instalment the budget reserves this period, from the API.
    expect(row.getByText(zl("Odkładaj 500 zł na okres"))).toBeOnTheScreen();
  });

  it("a reached goal says so and needs no instalment", async () => {
    seedFakeServer({ goals: [testGoal({ currentAmount: 400_000 })] });

    await openList();

    const row = within(await screen.findByRole("button", { name: "Wakacje" }));
    expect(row.getByText("Cel osiągnięty")).toBeOnTheScreen();
    expect(row.queryByText(/Odkładaj/)).not.toBeOnTheScreen();
  });

  it("an overdue goal says so", async () => {
    seedFakeServer({ goals: [testGoal({ targetDate: "2026-06-30" })] });

    await openList();

    const row = within(await screen.findByRole("button", { name: "Wakacje" }));
    expect(row.getByText("Po terminie")).toBeOnTheScreen();
  });

  it("while the budget loads, the goals show without the instalment", async () => {
    fakeApi.budget.current.mockReturnValueOnce(pending());

    await openList();

    const row = within(await screen.findByRole("button", { name: "Wakacje" }));
    expect(row.getByText(zl("1000 zł z 4000 zł"))).toBeOnTheScreen();
    expect(row.queryByText(/Odkładaj/)).not.toBeOnTheScreen();
  });

  it("shows a skeleton while loading", async () => {
    fakeApi.goals.list.mockReturnValueOnce(pending());

    await openList();

    expect(screen.getByLabelText("Wczytywanie celów")).toBeOnTheScreen();
  });

  it("shows an error with a retry", async () => {
    fakeApi.goals.list.mockRejectedValueOnce(
      new ApiError("invalid-response", 200, "Response does not match the schema"),
    );
    await openList();

    expect(await screen.findByText("Nie udało się wczytać celów.")).toBeOnTheScreen();
    await press("Spróbuj ponownie");

    expect(await screen.findByRole("button", { name: "Wakacje" })).toBeOnTheScreen();
  });

  it("has an empty state that invites to add one", async () => {
    seedFakeServer({ goals: [] });

    await openList();

    expect(await screen.findByText("Nie masz jeszcze celów.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Dodaj cel" })).toBeOnTheScreen();
  });
});

describe("adding", () => {
  it("saves the name, target, nothing saved yet, and the last day of the chosen month", async () => {
    const app = await openNew();

    await fillInBike();
    await press("Zapisz");

    await waitFor(() => {
      expect(app).toHavePathname("/goals");
    });
    expect(fakeApi.goals.create).toHaveBeenCalledWith(
      withKey({
        name: "Rower",
        targetAmount: 300_000,
        currentAmount: 0,
        targetDate: "2027-06-30",
      }),
    );
    expect(await screen.findByRole("button", { name: "Rower" })).toBeOnTheScreen();
  });

  it("'Już odłożone' is optional and counts toward the goal", async () => {
    await openNew();
    await fillInBike();

    await type("Już odłożone", "500");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.goals.create).toHaveBeenCalledWith(
        withKey(expect.objectContaining({ currentAmount: 50_000 })),
      );
    });
  });

  it("'Już odłożone' accepts 0", async () => {
    await openNew();
    await fillInBike();

    await type("Już odłożone", "0");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.goals.create).toHaveBeenCalledWith(
        withKey(expect.objectContaining({ currentAmount: 0 })),
      );
    });
  });

  it.each([
    ["2027", "2027-02-28"],
    ["2028", "2028-02-29"],
  ])("February %s ends on %s", async (year, targetDate) => {
    await openNew();
    await type("Nazwa", "Kurs");
    await type("Kwota docelowa", "1200");
    await choose("Luty");
    for (let y = 2026; y < Number(year); y += 1) await press("Następny rok");

    expect(screen.getByLabelText("Rok")).toHaveTextContent(year);
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.goals.create).toHaveBeenCalledWith(
        withKey(expect.objectContaining({ targetDate })),
      );
    });
  });

  it("the current month is a valid deadline", async () => {
    await openNew();
    await type("Nazwa", "Prezent");
    await type("Kwota docelowa", "200");

    await choose("Wrzesień");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.goals.create).toHaveBeenCalledWith(
        withKey(expect.objectContaining({ targetDate: "2026-09-30" })),
      );
    });
  });

  it("a past month is refused", async () => {
    await openNew();
    await type("Nazwa", "Prezent");
    await type("Kwota docelowa", "200");

    await choose("Sierpień");
    await press("Zapisz");

    expect(screen.getByText("Termin nie może być w przeszłości.")).toBeOnTheScreen();
    expect(fakeApi.goals.create).not.toHaveBeenCalled();
  });

  it("the year cannot go before the current one", async () => {
    await openNew();

    expect(screen.getByLabelText("Rok")).toHaveTextContent("2026");
    expect(screen.getByRole("button", { name: "Poprzedni rok" })).toBeDisabled();
  });

  it("validates the name, target, month and what is already saved", async () => {
    await openNew();
    await type("Już odłożone", "abc");

    await press("Zapisz");

    expect(screen.getByText("Podaj nazwę.")).toBeOnTheScreen();
    expect(screen.getByText("Podaj kwotę.")).toBeOnTheScreen();
    expect(screen.getByText("Wybierz miesiąc.")).toBeOnTheScreen();
    expect(screen.getByText("Podaj kwotę w złotych, np. 12,50.")).toBeOnTheScreen();
    expect(fakeApi.goals.create).not.toHaveBeenCalled();
  });

  it("a retry after a failure sends the same Idempotency-Key", async () => {
    fakeApi.goals.create.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    const app = await openNew();
    await fillInBike();
    await press("Zapisz");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
    );
    expect(app).toHavePathname("/goals/new");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.goals.create).toHaveBeenCalledTimes(2);
    });
    const [first, retry] = fakeApi.goals.create.mock.calls;
    expect(retry?.[0].idempotencyKey).toBe(first?.[0].idempotencyKey);
  });

  it("changing the form after a failure makes it a new goal, with a new key", async () => {
    fakeApi.goals.create.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    await openNew();
    await fillInBike();
    await press("Zapisz");
    await screen.findByRole("alert");

    await type("Kwota docelowa", "3500");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.goals.create).toHaveBeenCalledTimes(2);
    });
    const [first, retry] = fakeApi.goals.create.mock.calls;
    expect(retry?.[0].idempotencyKey).not.toBe(first?.[0].idempotencyKey);
  });

  it("blocks a second tap while saving", async () => {
    fakeApi.goals.create.mockReturnValueOnce(pending());
    await openNew();
    await fillInBike();

    await press("Zapisz");
    const button = await screen.findByRole("button", { name: "Zapisywanie…" });

    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(fakeApi.goals.create).toHaveBeenCalledTimes(1);
  });
});

describe("editing", () => {
  it("opens with the current values", async () => {
    const app = await openEdit();

    expect(app).toHavePathname(`/goals/${trip.id}`);
    expect(screen.getByLabelText("Nazwa")).toHaveDisplayValue("Wakacje");
    expect(screen.getByLabelText("Kwota docelowa")).toHaveDisplayValue("4000");
    expect(screen.getByLabelText("Już odłożone")).toHaveDisplayValue("1000");
    expect(screen.getByRole("radio", { name: "Czerwiec" })).toBeSelected();
    expect(screen.getByLabelText("Rok")).toHaveTextContent("2027");
  });

  it("sends only what changed", async () => {
    const app = await openEdit();

    await type("Kwota docelowa", "4500");
    await type("Już odłożone", "1200,50");
    await press("Zapisz");

    await waitFor(() => {
      expect(app).toHavePathname("/goals");
    });
    expect(fakeApi.goals.update).toHaveBeenCalledWith(trip.id, {
      targetAmount: 450_000,
      currentAmount: 120_050,
    });
  });

  it("a new month moves the deadline to its last day", async () => {
    await openEdit();

    await choose("Sierpień");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.goals.update).toHaveBeenCalledWith(trip.id, { targetDate: "2027-08-31" });
    });
  });

  it("an overdue goal keeps its past deadline when only the name changes", async () => {
    seedFakeServer({ goals: [testGoal({ targetDate: "2026-06-30" })] });
    await openEdit();

    await type("Nazwa", "Wakacje 2026");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.goals.update).toHaveBeenCalledWith(trip.id, { name: "Wakacje 2026" });
    });
  });

  it("nothing changed: returns without asking the API", async () => {
    const app = await openEdit();

    await press("Zapisz");

    await waitFor(() => {
      expect(app).toHavePathname("/goals");
    });
    expect(fakeApi.goals.update).not.toHaveBeenCalled();
  });

  it("an unknown id says so", async () => {
    await renderApp("/goals/01923b6e-0000-7000-8000-00000000dead", { signedIn: true });

    expect(await screen.findByText("Nie znaleziono tego celu.")).toBeOnTheScreen();
  });
});

describe("deleting — to the trash, with Cofnij", () => {
  it("moves the goal to the trash and offers to undo it on the list", async () => {
    const app = await openEdit();

    await press("Usuń cel");

    await waitFor(() => {
      expect(app).toHavePathname("/goals");
    });
    expect(fakeApi.goals.remove).toHaveBeenCalledWith(trip.id);
    expect(await screen.findByText("Nie masz jeszcze celów.")).toBeOnTheScreen();
    expect(screen.getByRole("alert")).toHaveTextContent("Usunięto cel „Wakacje”.");
  });

  it("Cofnij brings it back", async () => {
    await openEdit();
    await press("Usuń cel");

    await press("Cofnij");

    await waitFor(() => {
      expect(fakeApi.goals.restore).toHaveBeenCalledWith(trip.id);
    });
    expect(await screen.findByRole("button", { name: "Wakacje" })).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });

  it("Zamknij hides the notice; the goal stays in the trash", async () => {
    await openEdit();
    await press("Usuń cel");

    await press("Zamknij");

    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    expect(fakeApi.goals.restore).not.toHaveBeenCalled();
  });

  it("a failed undo says so and can be retried", async () => {
    fakeApi.goals.restore.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    await openEdit();
    await press("Usuń cel");

    await press("Cofnij");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się przywrócić celu „Wakacje”.",
    );
    await press("Spróbuj ponownie");
    expect(await screen.findByRole("button", { name: "Wakacje" })).toBeOnTheScreen();
  });

  it("a failed delete says why and keeps the goal", async () => {
    fakeApi.goals.remove.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    const app = await openEdit();

    await press("Usuń cel");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
    );
    expect(app).toHavePathname(`/goals/${trip.id}`);
  });
});
