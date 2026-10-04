import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi, seedFakeServer, testBudget, testDue } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

const rent = testDue();
const salary = testDue({
  kind: "INCOME",
  id: "01923b6e-0000-7000-8000-000000000042",
  label: "Pensja",
  expectedAmount: 500_000,
});

async function openDashboard() {
  await renderApp("/", { signedIn: true });
  await screen.findByRole("header", { name: "Twój budżet" });
}
const button = (name: string) => screen.findByRole("button", { name });
const press = async (name: string) => {
  await fireEvent.press(await button(name));
};

describe("Do potwierdzenia — na Dashboardzie", () => {
  it("nic nie czeka: karty nie ma", async () => {
    await openDashboard();

    await waitFor(() => {
      expect(fakeApi.confirmations.list).toHaveBeenCalled();
    });
    expect(screen.queryByRole("header", { name: "Do potwierdzenia" })).not.toBeOnTheScreen();
  });

  it("płatność: pytanie w formie neutralnej i cztery odpowiedzi", async () => {
    seedFakeServer({ due: [rent] });
    await openDashboard();

    expect(await screen.findByRole("header", { name: "Do potwierdzenia" })).toBeOnTheScreen();
    expect(screen.getByText(zl("Czynsz 1500 zł — zapłacone?"))).toBeOnTheScreen();
    expect(screen.getByText("Termin 28 września")).toBeOnTheScreen();
    for (const answer of ["Tak", "Inna kwota", "Jeszcze nie", "Nie w tym okresie"]) {
      expect(await button(`${answer}: Czynsz`)).toBeOnTheScreen();
    }
  });

  it("wpływ: Tak, Inna kwota, Jeszcze nie — bez „Nie w tym okresie”", async () => {
    seedFakeServer({ due: [salary] });
    await openDashboard();

    expect(await screen.findByText(zl("Pensja 5000 zł — wpłynęło?"))).toBeOnTheScreen();
    expect(await button("Tak: Pensja")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Inna kwota: Pensja" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Jeszcze nie: Pensja" })).toBeOnTheScreen();
    expect(
      screen.queryByRole("button", { name: "Nie w tym okresie: Pensja" }),
    ).not.toBeOnTheScreen();
  });

  it("Tak: wysyła odpowiedź, pozycja znika, budżet się odświeża", async () => {
    seedFakeServer({ due: [rent] });
    await openDashboard();
    const budgetCalls = fakeApi.budget.current.mock.calls.length;

    await press("Tak: Czynsz");

    await waitFor(() => {
      expect(screen.queryByText(zl("Czynsz 1500 zł — zapłacone?"))).not.toBeOnTheScreen();
    });
    expect(fakeApi.confirmations.answer).toHaveBeenCalledWith({
      kind: "EXPENSE",
      recurringRuleId: rent.id,
      occurrenceDate: "2026-09-28",
      answer: "CONFIRMED",
    });
    expect(fakeApi.budget.current.mock.calls.length).toBeGreaterThan(budgetCalls);
    expect(screen.queryByRole("header", { name: "Do potwierdzenia" })).not.toBeOnTheScreen();
  });

  it("wpływ Tak: wysyła id źródła", async () => {
    seedFakeServer({ due: [salary] });
    await openDashboard();

    await press("Tak: Pensja");

    await waitFor(() => {
      expect(fakeApi.confirmations.answer).toHaveBeenCalledWith({
        kind: "INCOME",
        incomeSourceId: salary.id,
        occurrenceDate: "2026-09-28",
        answer: "CONFIRMED",
      });
    });
  });

  it("Inna kwota: pole kwoty, zapis z kwotą w groszach", async () => {
    seedFakeServer({ due: [rent] });
    await openDashboard();

    await press("Inna kwota: Czynsz");
    await fireEvent.changeText(await screen.findByLabelText("Kwota: Czynsz"), "1612,50");
    await press("Zapisz: Czynsz");

    await waitFor(() => {
      expect(fakeApi.confirmations.answer).toHaveBeenCalledWith(
        expect.objectContaining({ answer: "CONFIRMED", amount: 161_250 }),
      );
    });
  });

  it("Inna kwota: zła kwota mówi dlaczego i nic nie wysyła; Anuluj wraca do pytania", async () => {
    seedFakeServer({ due: [rent] });
    await openDashboard();

    await press("Inna kwota: Czynsz");
    await fireEvent.changeText(await screen.findByLabelText("Kwota: Czynsz"), "0");
    await press("Zapisz: Czynsz");

    expect(await screen.findByText("Kwota musi być większa od zera.")).toBeOnTheScreen();
    expect(fakeApi.confirmations.answer).not.toHaveBeenCalled();

    await press("Anuluj: Czynsz");
    expect(await button("Tak: Czynsz")).toBeOnTheScreen();
  });

  it("Jeszcze nie: pozycja zostaje, ale już nie pyta", async () => {
    seedFakeServer({ due: [rent] });
    await openDashboard();

    await press("Jeszcze nie: Czynsz");

    expect(await screen.findByText(zl("Czynsz 1500 zł — jeszcze nie zapłacone"))).toBeOnTheScreen();
    expect(fakeApi.confirmations.answer).toHaveBeenCalledWith(
      expect.objectContaining({ answer: "NOT_YET" }),
    );
    expect(screen.queryByRole("button", { name: "Jeszcze nie: Czynsz" })).not.toBeOnTheScreen();
    // Zapłacone później tego samego dnia — da się odpowiedzieć od razu.
    expect(screen.getByRole("button", { name: "Tak: Czynsz" })).toBeOnTheScreen();
  });

  it("wpływ po „Jeszcze nie”: „jeszcze nie wpłynęło”", async () => {
    seedFakeServer({ due: [{ ...salary, askToday: false }] });
    await openDashboard();

    expect(await screen.findByText(zl("Pensja 5000 zł — jeszcze nie wpłynęło"))).toBeOnTheScreen();
  });

  it("Nie w tym okresie: wysyła SKIPPED, pozycja znika", async () => {
    seedFakeServer({ due: [rent] });
    await openDashboard();

    await press("Nie w tym okresie: Czynsz");

    await waitFor(() => {
      expect(screen.queryByText(zl("Czynsz 1500 zł — zapłacone?"))).not.toBeOnTheScreen();
    });
    expect(fakeApi.confirmations.answer).toHaveBeenCalledWith(
      expect.objectContaining({ answer: "SKIPPED" }),
    );
  });

  it("zaległa płatność z poprzedniego okresu jest oznaczona", async () => {
    seedFakeServer({ due: [{ ...rent, occurrenceDate: "2026-09-05", overdue: true }] });
    await openDashboard();

    expect(await screen.findByText("Zaległe, termin 5 września")).toBeOnTheScreen();
  });

  it("nieudany zapis: komunikat, pozycja zostaje i da się spróbować znowu", async () => {
    seedFakeServer({ due: [rent] });
    fakeApi.confirmations.answer.mockRejectedValueOnce(new ApiError("http", 500, "boom"));
    await openDashboard();

    await press("Tak: Czynsz");

    expect(
      await screen.findByText("Nie udało się zapisać odpowiedzi. Spróbuj ponownie."),
    ).toBeOnTheScreen();
    await press("Tak: Czynsz");
    await waitFor(() => {
      expect(screen.queryByText(zl("Czynsz 1500 zł — zapłacone?"))).not.toBeOnTheScreen();
    });
  });

  it("lista się nie wczytała: komunikat z ponowieniem, budżet zostaje", async () => {
    const error = new ApiError("invalid-response", 200, "Response does not match the schema");
    fakeApi.confirmations.list.mockRejectedValueOnce(error);
    seedFakeServer({ due: [rent] });
    await openDashboard();

    expect(
      await screen.findByText("Nie udało się sprawdzić, co czeka na potwierdzenie."),
    ).toBeOnTheScreen();
    expect(screen.getByText("Możesz wydać")).toBeOnTheScreen();
    await press("Spróbuj ponownie");
    expect(await screen.findByText(zl("Czynsz 1500 zł — zapłacone?"))).toBeOnTheScreen();
  });
});

describe("pieniądze, które jeszcze nie wpłynęły", () => {
  it("budżet mówi wprost, ile z „Możesz wydać” jeszcze nie wpłynęło", async () => {
    fakeApi.budget.current.mockResolvedValueOnce({ ...testBudget, awaitingIncome: 500_000 });
    await openDashboard();

    expect(await screen.findByText(zl("W tym 5000 zł jeszcze nie wpłynęło."))).toBeOnTheScreen();
  });

  it("gdy wszystko wpłynęło, tej linii nie ma", async () => {
    await openDashboard();

    await screen.findByText("Możesz wydać");
    expect(screen.queryByText(/jeszcze nie wpłynęło/)).not.toBeOnTheScreen();
  });
});
