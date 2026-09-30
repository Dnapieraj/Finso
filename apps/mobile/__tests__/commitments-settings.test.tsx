import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import {
  billsCategory,
  fakeApi,
  pending,
  seedFakeServer,
  testCategory,
  testRule,
} from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

/** The draft `create` gets: the input with its own Idempotency-Key. */
const withKey = (input: unknown) => ({ input, idempotencyKey: expect.any(String) as unknown });

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(() => {
  resetSecureStore();
  fakeApi.categories.list.mockResolvedValue([testCategory, billsCategory]);
});

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", " ");

const rent = testRule();

const header = (name: string) => screen.findByRole("header", { name });
const press = async (name: string) => {
  await fireEvent.press(screen.getByRole("button", { name }));
};
const choose = async (name: string) => {
  await fireEvent.press(await screen.findByRole("radio", { name }));
};
const type = async (label: string, text: string) => {
  await fireEvent.changeText(screen.getByLabelText(label), text);
};

async function openList() {
  const app = await renderApp("/settings/commitments", { signedIn: true });
  await header("Stałe zobowiązania");
  return app;
}

async function openNew() {
  const app = await openList();
  await press("Dodaj zobowiązanie");
  await header("Nowe zobowiązanie");
  return app;
}

async function openEdit() {
  const app = await openList();
  await fireEvent.press(await screen.findByRole("button", { name: "Czynsz" }));
  await header("Edytuj zobowiązanie");
  return app;
}

/** Name, amount and category of a new commitment; the schedule is up to the test. */
async function fillIn(name: string, amount: string) {
  await type("Nazwa", name);
  await type("Kwota", amount);
  await choose("Rachunki");
}

describe("list", () => {
  it("shows the active expense rules with amount, schedule and category", async () => {
    seedFakeServer({
      rules: [
        rent,
        testRule({
          id: "01923b6e-0000-7000-8000-000000000042",
          name: "Siłownia",
          frequency: "WEEKLY",
          interval: 2,
          dayOfMonth: null,
          dayOfWeek: 3,
          expectedAmount: 5_999,
        }),
        testRule({
          id: "01923b6e-0000-7000-8000-000000000043",
          name: "Stary abonament",
          isActive: false,
        }),
        // A salary schedule is an income, managed on its own screen.
        testRule({
          id: "01923b6e-0000-7000-8000-000000000044",
          kind: "INCOME",
          name: null,
          expectedAmount: null,
          categoryId: null,
        }),
      ],
    });

    await openList();

    const row = within(await screen.findByRole("button", { name: "Czynsz" }));
    expect(row.getByText(`${zl("1500 zł")} · co miesiąc, 5. dnia`)).toBeOnTheScreen();
    expect(row.getByText("Rachunki")).toBeOnTheScreen();
    // A cost rounds up: 59,99 zł shows as 60 zł.
    expect(
      within(screen.getByRole("button", { name: "Siłownia" })).getByText(
        `${zl("60 zł")} · co 2 tygodnie, w środę`,
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Stary abonament")).not.toBeOnTheScreen();
    // Two rows: the income rule and the inactive one are not listed.
    expect(screen.getAllByText(/ · co /)).toHaveLength(2);
  });

  it("shows a skeleton while loading", async () => {
    fakeApi.recurringRules.list.mockReturnValueOnce(pending());

    await openList();

    expect(screen.getByLabelText("Wczytywanie zobowiązań")).toBeOnTheScreen();
  });

  it("shows an error with a retry", async () => {
    fakeApi.recurringRules.list.mockRejectedValueOnce(
      new ApiError("invalid-response", 200, "Response does not match the schema"),
    );
    await openList();

    expect(await screen.findByText("Nie udało się wczytać zobowiązań.")).toBeOnTheScreen();
    await press("Spróbuj ponownie");

    expect(await screen.findByRole("button", { name: "Czynsz" })).toBeOnTheScreen();
  });

  it("has an empty state", async () => {
    seedFakeServer({ rules: [] });

    await openList();

    expect(await screen.findByText("Nie masz stałych zobowiązań.")).toBeOnTheScreen();
  });
});

describe("adding", () => {
  it("every month: counted from today, as anything paid earlier is already an expense", async () => {
    const app = await openNew();

    await fillIn("Siłownia", "120");
    await type("Dzień miesiąca", "15");
    await press("Zapisz");

    await waitFor(() => {
      expect(app).toHavePathname("/settings/commitments");
    });
    expect(fakeApi.recurringRules.create).toHaveBeenCalledWith(
      withKey({
        kind: "EXPENSE",
        name: "Siłownia",
        frequency: "MONTHLY",
        interval: 1,
        // testBudget.asOf: the budget's "today" in the user's zone.
        startDate: "2026-09-28",
        dayOfMonth: 15,
        dayOfWeek: null,
        expectedAmount: 12_000,
        categoryId: billsCategory.id,
      }),
    );
    expect(await screen.findByRole("button", { name: "Siłownia" })).toBeOnTheScreen();
  });

  it("every week", async () => {
    await openNew();

    await fillIn("Basen", "40");
    await choose("Co tydzień");
    await choose("Piątek");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.recurringRules.create).toHaveBeenCalledWith(
        withKey(
          expect.objectContaining({
            frequency: "WEEKLY",
            interval: 1,
            startDate: "2026-09-28",
            dayOfMonth: null,
            dayOfWeek: 5,
          }),
        ),
      );
    });
  });

  it("every 2 weeks from the next payment in the chosen week", async () => {
    await openNew();

    await fillIn("Sprzątanie", "150");
    await choose("Co 2 tygodnie");
    await choose("Piątek");
    await choose("W przyszłym tygodniu");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.recurringRules.create).toHaveBeenCalledWith(
        withKey(
          expect.objectContaining({
            frequency: "WEEKLY",
            interval: 2,
            startDate: "2026-10-09",
            dayOfWeek: 5,
          }),
        ),
      );
    });
  });

  it("the name is required for a commitment, as is the category", async () => {
    await openNew();

    await press("Zapisz");

    expect(screen.getByText("Podaj nazwę.")).toBeOnTheScreen();
    expect(screen.getByText("Podaj kwotę.")).toBeOnTheScreen();
    expect(screen.getByText("Podaj dzień od 1 do 31.")).toBeOnTheScreen();
    expect(screen.getByText("Wybierz kategorię.")).toBeOnTheScreen();
    expect(fakeApi.recurringRules.create).not.toHaveBeenCalled();
  });

  it("every week needs the weekday", async () => {
    await openNew();
    await fillIn("Basen", "40");
    await choose("Co tydzień");

    await press("Zapisz");

    expect(screen.getByText("Wybierz dzień tygodnia.")).toBeOnTheScreen();
  });

  it("a failed save says why and stays on the form", async () => {
    fakeApi.recurringRules.create.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    const app = await openNew();
    await fillIn("Siłownia", "120");
    await type("Dzień miesiąca", "15");

    await press("Zapisz");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
    );
    expect(app).toHavePathname("/settings/commitments/new");
  });

  it("a retry after a failure sends the same Idempotency-Key", async () => {
    fakeApi.recurringRules.create.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    await openNew();
    await fillIn("Siłownia", "120");
    await type("Dzień miesiąca", "15");
    await press("Zapisz");
    await screen.findByRole("alert");

    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.recurringRules.create).toHaveBeenCalledTimes(2);
    });
    const [first, retry] = fakeApi.recurringRules.create.mock.calls;
    expect(retry?.[0].idempotencyKey).toBe(first?.[0].idempotencyKey);
  });
});

describe("editing", () => {
  it("opens with the current values", async () => {
    const app = await openEdit();

    expect(app).toHavePathname(`/settings/commitments/${rent.id}`);
    expect(screen.getByLabelText("Nazwa")).toHaveDisplayValue("Czynsz");
    expect(screen.getByLabelText("Kwota")).toHaveDisplayValue("1500");
    expect(screen.getByRole("radio", { name: "Co miesiąc" })).toBeSelected();
    expect(screen.getByLabelText("Dzień miesiąca")).toHaveDisplayValue("5");
    expect(await screen.findByRole("radio", { name: "Rachunki" })).toBeSelected();
  });

  it("a new amount keeps the schedule and its start as they are", async () => {
    const app = await openEdit();

    await type("Kwota", "1600");
    await press("Zapisz");

    await waitFor(() => {
      expect(app).toHavePathname("/settings/commitments");
    });
    expect(fakeApi.recurringRules.update).toHaveBeenCalledWith(rent.id, {
      expectedAmount: 160_000,
    });
  });

  it("a new schedule gets a new start", async () => {
    await openEdit();

    await choose("Co 2 tygodnie");
    await choose("Piątek");
    await choose("W tym tygodniu");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.recurringRules.update).toHaveBeenCalledWith(rent.id, {
        frequency: "WEEKLY",
        interval: 2,
        startDate: "2026-10-02",
        dayOfMonth: null,
        dayOfWeek: 5,
      });
    });
  });

  it("an unknown id says so", async () => {
    await renderApp("/settings/commitments/01923b6e-0000-7000-8000-00000000dead", {
      signedIn: true,
    });

    expect(await screen.findByText("Nie znaleziono tego zobowiązania.")).toBeOnTheScreen();
  });
});

describe("deleting", () => {
  it("asks first and says that expenses already saved stay", async () => {
    await openEdit();

    await press("Usuń zobowiązanie");

    expect(screen.getByText("Wydatki, które już zapisałeś, zostaną.")).toBeOnTheScreen();
    expect(fakeApi.recurringRules.remove).not.toHaveBeenCalled();
  });

  it("deletes and returns to the list without it", async () => {
    const app = await openEdit();
    await press("Usuń zobowiązanie");

    await press("Usuń");

    await waitFor(() => {
      expect(app).toHavePathname("/settings/commitments");
    });
    expect(fakeApi.recurringRules.remove).toHaveBeenCalledWith(rent.id);
    expect(await screen.findByText("Nie masz stałych zobowiązań.")).toBeOnTheScreen();
  });

  it("a failed delete says why and keeps it", async () => {
    fakeApi.recurringRules.remove.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    const app = await openEdit();
    await press("Usuń zobowiązanie");

    await press("Usuń");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
    );
    expect(app).toHavePathname(`/settings/commitments/${rent.id}`);
  });
});
