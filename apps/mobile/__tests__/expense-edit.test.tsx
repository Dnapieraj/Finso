import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import {
  fakeApi,
  pending,
  seedFakeServer,
  testCategory,
  testTransaction,
} from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

const transport = {
  ...testCategory,
  id: "01923b6e-0000-7000-8000-000000000023",
  name: "Transport",
  icon: "car",
  color: "#3B82F6",
};

/** 45,00 zł for lunch on 27 September; today is 28 September (testBudget.asOf). */
const lunch = testTransaction({
  id: "01923b6e-0000-7000-8000-000000000701",
  amount: 4_500,
  date: "2026-09-27",
  note: "Obiad",
});

beforeEach(() => {
  resetSecureStore();
  fakeApi.categories.list.mockResolvedValue([testCategory, transport]);
  seedFakeServer({ transactions: [lunch] });
});

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
const lunchRow = () => screen.findByRole("button", { name: /^Jedzenie, 27 września/ });

async function openEdit() {
  const app = await renderApp("/history", { signedIn: true });
  await fireEvent.press(await lunchRow());
  await header("Edytuj wydatek");
  return app;
}

describe("editing", () => {
  it("opens from the history row with the current values", async () => {
    const app = await openEdit();

    expect(app).toHavePathname(`/expense/${lunch.id}`);
    expect(screen.getByLabelText("Kwota")).toHaveDisplayValue("45");
    expect(await screen.findByRole("radio", { name: "Jedzenie" })).toBeSelected();
    expect(screen.getByLabelText("Notatka")).toHaveDisplayValue("Obiad");
    expect(screen.getByRole("radio", { name: "27 września" })).toBeSelected();
  });

  it("sends only what changed and returns to the history", async () => {
    const app = await openEdit();

    await type("Kwota", "50");
    await press("Zapisz");

    await waitFor(() => {
      expect(app).toHavePathname("/history");
    });
    expect(fakeApi.transactions.update).toHaveBeenCalledWith(lunch.id, { amount: 5_000 });
    expect(await screen.findByText(zl("50,00 zł"))).toBeOnTheScreen();
  });

  it("Wstecz returns to the history it was opened from, not to the dashboard", async () => {
    const app = await openEdit();

    await press("Wstecz");

    await header("Historia wydatków");
    expect(app).toHavePathname("/history");
  });

  it("a new category and a cleared note (sent as null)", async () => {
    await openEdit();

    await choose("Transport");
    await type("Notatka", "  ");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.transactions.update).toHaveBeenCalledWith(lunch.id, {
        categoryId: transport.id,
        note: null,
      });
    });
  });

  it("the date: another day of the period — the usual fix is „it was yesterday”", async () => {
    await openEdit();

    await choose("25 września");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.transactions.update).toHaveBeenCalledWith(lunch.id, { date: "2026-09-25" });
    });
  });

  it("the date: a day of the previous period", async () => {
    await openEdit();

    await press("Poprzedni okres");
    await choose("5 września");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.transactions.update).toHaveBeenCalledWith(lunch.id, { date: "2026-09-05" });
    });
  });

  it("days after today cannot be chosen", async () => {
    await openEdit();

    expect(screen.getByRole("radio", { name: "28 września" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "29 września" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Następny okres" })).toBeDisabled();
  });

  it("validates the amount", async () => {
    await openEdit();

    await type("Kwota", "0");
    await press("Zapisz");

    expect(screen.getByText("Kwota musi być większa od zera.")).toBeOnTheScreen();
    expect(fakeApi.transactions.update).not.toHaveBeenCalled();
  });

  it("nothing changed: returns without asking the API", async () => {
    const app = await openEdit();

    await press("Zapisz");

    await waitFor(() => {
      expect(app).toHavePathname("/history");
    });
    expect(fakeApi.transactions.update).not.toHaveBeenCalled();
  });

  it("a failed save says why and stays on the form", async () => {
    fakeApi.transactions.update.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    const app = await openEdit();
    await type("Kwota", "50");

    await press("Zapisz");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
    );
    expect(app).toHavePathname(`/expense/${lunch.id}`);
  });

  it("blocks a second tap while saving", async () => {
    fakeApi.transactions.update.mockReturnValueOnce(pending());
    await openEdit();
    await type("Kwota", "50");

    await press("Zapisz");
    const button = await screen.findByRole("button", { name: "Zapisywanie…" });

    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(fakeApi.transactions.update).toHaveBeenCalledTimes(1);
  });

  it("an unknown id says so", async () => {
    await renderApp("/expense/01923b6e-0000-7000-8000-00000000dead", { signedIn: true });

    expect(await screen.findByText("Nie znaleziono tego wydatku.")).toBeOnTheScreen();
  });
});

// A notification or a shared link opens the screen with nothing under it.
describe("opened by a link", () => {
  async function openByLink() {
    const app = await renderApp(`/expense/${lunch.id}`, { signedIn: true });
    await header("Edytuj wydatek");
    return app;
  }

  it("Wstecz goes to the dashboard instead of leaving the app", async () => {
    const app = await openByLink();

    await press("Wstecz");

    await header("Twój budżet");
    expect(app).toHavePathname("/");
  });

  it("saving goes to the dashboard", async () => {
    const app = await openByLink();

    await type("Kwota", "50");
    await press("Zapisz");

    await header("Twój budżet");
    expect(app).toHavePathname("/");
    expect(fakeApi.transactions.update).toHaveBeenCalledWith(lunch.id, { amount: 5_000 });
  });
});

describe("deleting — to the trash, with Cofnij", () => {
  it("moves the expense to the trash and offers to undo it on the history", async () => {
    const app = await openEdit();

    await press("Usuń wydatek");

    await waitFor(() => {
      expect(app).toHavePathname("/history");
    });
    expect(fakeApi.transactions.remove).toHaveBeenCalledWith(lunch.id);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      zl("Usunięto wydatek 45,00 zł · Jedzenie."),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^Jedzenie, 27 września/ }),
      ).not.toBeOnTheScreen();
    });
  });

  it("Cofnij brings it back", async () => {
    await openEdit();
    await press("Usuń wydatek");

    await press("Cofnij");

    await waitFor(() => {
      expect(fakeApi.transactions.restore).toHaveBeenCalledWith(lunch.id);
    });
    expect(await lunchRow()).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });

  it("Zamknij hides the notice; the expense stays in the trash", async () => {
    await openEdit();
    await press("Usuń wydatek");

    await press("Zamknij");

    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    expect(fakeApi.transactions.restore).not.toHaveBeenCalled();
  });

  it("a failed undo says so and can be retried", async () => {
    fakeApi.transactions.restore.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    await openEdit();
    await press("Usuń wydatek");

    await press("Cofnij");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      zl("Nie udało się przywrócić wydatku 45,00 zł."),
    );
    await press("Spróbuj ponownie");
    expect(await lunchRow()).toBeOnTheScreen();
  });

  it("a failed delete says why and keeps the expense", async () => {
    fakeApi.transactions.remove.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    const app = await openEdit();

    await press("Usuń wydatek");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
    );
    expect(app).toHavePathname(`/expense/${lunch.id}`);
  });
});
