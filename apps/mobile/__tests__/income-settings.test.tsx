import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import { fakeApi, pending, seedFakeServer, testIncomeSource } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", " ");

const salary = testIncomeSource();
const freelance = testIncomeSource({
  id: "01923b6e-0000-7000-8000-000000000051",
  name: "Zlecenia",
  kind: "IRREGULAR",
  expectedAmount: null,
  recurringRuleId: null,
  schedule: null,
});

const header = (name: string) => screen.findByRole("header", { name });
const press = async (name: string) => {
  await fireEvent.press(screen.getByRole("button", { name }));
};
const choose = async (name: string) => {
  await fireEvent.press(screen.getByRole("radio", { name }));
};
const type = async (label: string, text: string) => {
  await fireEvent.changeText(screen.getByLabelText(label), text);
};

async function openList() {
  const app = await renderApp("/settings/income", { signedIn: true });
  await header("Dochody");
  return app;
}

async function openNew() {
  const app = await openList();
  await press("Dodaj dochód");
  await header("Nowy dochód");
  return app;
}

async function openEdit(name = "Wypłata") {
  const app = await openList();
  await fireEvent.press(await screen.findByRole("button", { name }));
  await header("Edytuj dochód");
  return app;
}

describe("list", () => {
  it("shows each active income with its amount and schedule", async () => {
    seedFakeServer({
      sources: [
        salary,
        freelance,
        testIncomeSource({
          id: "01923b6e-0000-7000-8000-000000000052",
          name: "Stypendium",
          expectedAmount: 60_000,
          schedule: {
            frequency: "WEEKLY",
            interval: 2,
            startDate: "2026-09-04",
            dayOfMonth: null,
            dayOfWeek: 5,
          },
        }),
        testIncomeSource({
          id: "01923b6e-0000-7000-8000-000000000053",
          name: "Korepetycje",
          expectedAmount: 20_000,
          schedule: {
            frequency: "WEEKLY",
            interval: 1,
            startDate: "2026-09-10",
            dayOfMonth: null,
            dayOfWeek: 1,
          },
        }),
        testIncomeSource({
          id: "01923b6e-0000-7000-8000-000000000054",
          name: "Stara praca",
          isActive: false,
        }),
      ],
    });

    await openList();

    const row = (name: string) => within(screen.getByRole("button", { name }));
    expect(await screen.findByText(`${zl("5000 zł")} · co miesiąc, 10. dnia`)).toBeOnTheScreen();
    expect(row("Zlecenia").getByText("Nieregularny")).toBeOnTheScreen();
    expect(
      row("Stypendium").getByText(`${zl("600 zł")} · co 2 tygodnie, w piątek`),
    ).toBeOnTheScreen();
    expect(
      row("Korepetycje").getByText(`${zl("200 zł")} · co tydzień, w poniedziałek`),
    ).toBeOnTheScreen();
    // Archived: its history stays, but it is no longer an income.
    expect(screen.queryByText("Stara praca")).not.toBeOnTheScreen();
  });

  it("shows a skeleton while loading", async () => {
    fakeApi.incomeSources.list.mockReturnValueOnce(pending());

    await openList();

    expect(screen.getByLabelText("Wczytywanie dochodów")).toBeOnTheScreen();
  });

  it("shows an error with a retry", async () => {
    fakeApi.incomeSources.list.mockRejectedValueOnce(
      new ApiError("invalid-response", 200, "Response does not match the schema"),
    );
    await openList();

    expect(await screen.findByText("Nie udało się wczytać dochodów.")).toBeOnTheScreen();
    await press("Spróbuj ponownie");

    expect(await screen.findByRole("button", { name: "Wypłata" })).toBeOnTheScreen();
  });

  it("has an empty state", async () => {
    seedFakeServer({ sources: [] });

    await openList();

    expect(await screen.findByText("Nie masz jeszcze dochodów.")).toBeOnTheScreen();
  });
});

describe("adding", () => {
  it("regular, every month: counted from the period start, like the payday", async () => {
    const app = await openNew();

    await type("Nazwa", "Premia");
    await type("Kwota", "1000");
    await type("Dzień miesiąca", "25");
    await press("Zapisz");

    await waitFor(() => {
      expect(app).toHavePathname("/settings/income");
    });
    expect(fakeApi.incomeSources.create).toHaveBeenCalledWith({
      name: "Premia",
      kind: "REGULAR",
      expectedAmount: 100_000,
      schedule: {
        frequency: "MONTHLY",
        interval: 1,
        // The budget period of testBudget starts on 10 September.
        startDate: "2026-09-10",
        dayOfMonth: 25,
        dayOfWeek: null,
      },
    });
    expect(await screen.findByRole("button", { name: "Premia" })).toBeOnTheScreen();
  });

  it("regular, every 2 weeks: the chosen week sets which Fridays", async () => {
    await openNew();

    await type("Nazwa", "Stypendium");
    await type("Kwota", "600");
    await choose("Co 2 tygodnie");
    await choose("Piątek");
    await choose("W tym tygodniu");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.incomeSources.create).toHaveBeenCalledWith(
        expect.objectContaining({
          schedule: {
            frequency: "WEEKLY",
            interval: 2,
            // Friday 2 October, moved back in 14-day steps to the period start.
            startDate: "2026-09-04",
            dayOfMonth: null,
            dayOfWeek: 5,
          },
        }),
      );
    });
  });

  it("regular, every week: only the weekday", async () => {
    await openNew();

    await type("Nazwa", "Korepetycje");
    await type("Kwota", "200");
    await choose("Co tydzień");
    await choose("Poniedziałek");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.incomeSources.create).toHaveBeenCalledWith(
        expect.objectContaining({
          schedule: {
            frequency: "WEEKLY",
            interval: 1,
            startDate: "2026-09-10",
            dayOfMonth: null,
            dayOfWeek: 1,
          },
        }),
      );
    });
    expect(screen.queryByRole("radio", { name: "W tym tygodniu" })).not.toBeOnTheScreen();
  });

  it("irregular: only a name — it counts as money comes in", async () => {
    await openNew();

    await choose("Nieregularny");
    expect(screen.queryByLabelText("Kwota")).not.toBeOnTheScreen();
    expect(screen.queryByRole("radio", { name: "Co miesiąc" })).not.toBeOnTheScreen();
    await type("Nazwa", "Zlecenia");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.incomeSources.create).toHaveBeenCalledWith({
        name: "Zlecenia",
        kind: "IRREGULAR",
        expectedAmount: null,
        schedule: null,
      });
    });
  });

  it("validates the name, amount and day", async () => {
    await openNew();

    await press("Zapisz");

    expect(screen.getByText("Podaj nazwę.")).toBeOnTheScreen();
    expect(screen.getByText("Podaj kwotę.")).toBeOnTheScreen();
    expect(screen.getByText("Podaj dzień od 1 do 31.")).toBeOnTheScreen();
    expect(fakeApi.incomeSources.create).not.toHaveBeenCalled();
  });

  it("every 2 weeks needs the weekday and the week of the next payment", async () => {
    await openNew();
    await type("Nazwa", "Stypendium");
    await type("Kwota", "600");
    await choose("Co 2 tygodnie");

    await press("Zapisz");

    expect(screen.getByText("Wybierz dzień tygodnia.")).toBeOnTheScreen();
    expect(screen.getByText("Wybierz tydzień najbliższej płatności.")).toBeOnTheScreen();
    expect(fakeApi.incomeSources.create).not.toHaveBeenCalled();
  });

  it("a failed save says why and stays on the form", async () => {
    fakeApi.incomeSources.create.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    const app = await openNew();
    await type("Nazwa", "Premia");
    await type("Kwota", "1000");
    await type("Dzień miesiąca", "25");

    await press("Zapisz");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
    );
    expect(app).toHavePathname("/settings/income/new");
    expect(screen.getByLabelText("Nazwa")).toHaveDisplayValue("Premia");
  });

  it("blocks a second tap while saving", async () => {
    fakeApi.incomeSources.create.mockReturnValueOnce(pending());
    await openNew();
    await type("Nazwa", "Premia");
    await type("Kwota", "1000");
    await type("Dzień miesiąca", "25");

    await press("Zapisz");
    const button = await screen.findByRole("button", { name: "Zapisywanie…" });

    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(fakeApi.incomeSources.create).toHaveBeenCalledTimes(1);
  });
});

describe("editing — fixing a mistake from onboarding", () => {
  it("opens with the current values; the kind is not editable", async () => {
    const app = await openEdit();

    expect(app).toHavePathname(`/settings/income/${salary.id}`);
    expect(screen.getByLabelText("Nazwa")).toHaveDisplayValue("Wypłata");
    expect(screen.getByLabelText("Kwota")).toHaveDisplayValue("5000");
    expect(screen.getByRole("radio", { name: "Co miesiąc" })).toBeSelected();
    expect(screen.getByLabelText("Dzień miesiąca")).toHaveDisplayValue("10");
    expect(screen.queryByRole("radio", { name: "Nieregularny" })).not.toBeOnTheScreen();
  });

  it("a new name and amount keep the schedule as it is", async () => {
    const app = await openEdit();

    await type("Nazwa", "Pensja");
    await type("Kwota", "5200,50");
    await press("Zapisz");

    await waitFor(() => {
      expect(app).toHavePathname("/settings/income");
    });
    expect(fakeApi.incomeSources.update).toHaveBeenCalledWith(salary.id, {
      name: "Pensja",
      expectedAmount: 520_050,
    });
    expect(await screen.findByRole("button", { name: "Pensja" })).toBeOnTheScreen();
  });

  it("a new day sends the whole schedule", async () => {
    await openEdit();

    await type("Dzień miesiąca", "12");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.incomeSources.update).toHaveBeenCalledWith(salary.id, {
        schedule: {
          frequency: "MONTHLY",
          interval: 1,
          startDate: "2026-09-10",
          dayOfMonth: 12,
          dayOfWeek: null,
        },
      });
    });
  });

  it("nothing changed: returns without asking the API", async () => {
    const app = await openEdit();

    await press("Zapisz");

    await waitFor(() => {
      expect(app).toHavePathname("/settings/income");
    });
    expect(fakeApi.incomeSources.update).not.toHaveBeenCalled();
  });

  it("irregular income: only the name can change", async () => {
    seedFakeServer({ sources: [salary, freelance] });
    await openEdit("Zlecenia");

    expect(screen.queryByLabelText("Kwota")).not.toBeOnTheScreen();
    await type("Nazwa", "Freelance");
    await press("Zapisz");

    await waitFor(() => {
      expect(fakeApi.incomeSources.update).toHaveBeenCalledWith(freelance.id, {
        name: "Freelance",
      });
    });
  });

  it("an unknown id says so", async () => {
    await renderApp("/settings/income/01923b6e-0000-7000-8000-00000000dead", { signedIn: true });

    expect(await screen.findByText("Nie znaleziono tego dochodu.")).toBeOnTheScreen();
  });
});

describe("deleting", () => {
  it("asks first and says that entries already saved stay", async () => {
    await openEdit();

    await press("Usuń dochód");

    expect(screen.getByText("Wpływy, które już zapisałeś, zostaną w historii.")).toBeOnTheScreen();
    expect(fakeApi.incomeSources.remove).not.toHaveBeenCalled();
  });

  it("Anuluj keeps it", async () => {
    await openEdit();
    await press("Usuń dochód");

    await press("Anuluj");

    expect(screen.getByRole("button", { name: "Usuń dochód" })).toBeOnTheScreen();
    expect(fakeApi.incomeSources.remove).not.toHaveBeenCalled();
  });

  it("deletes and returns to the list without it", async () => {
    const app = await openEdit();
    await press("Usuń dochód");

    await press("Usuń");

    await waitFor(() => {
      expect(app).toHavePathname("/settings/income");
    });
    expect(fakeApi.incomeSources.remove).toHaveBeenCalledWith(salary.id);
    expect(await screen.findByText("Nie masz jeszcze dochodów.")).toBeOnTheScreen();
  });

  it("with entries saved (409) it is archived instead — the same result for the user", async () => {
    fakeApi.incomeSources.remove.mockRejectedValueOnce(
      new ApiError("http", 409, "Income source has income entries"),
    );
    const app = await openEdit();
    await press("Usuń dochód");

    await press("Usuń");

    await waitFor(() => {
      expect(app).toHavePathname("/settings/income");
    });
    expect(fakeApi.incomeSources.update).toHaveBeenCalledWith(salary.id, { isActive: false });
    expect(await screen.findByText("Nie masz jeszcze dochodów.")).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });
});
