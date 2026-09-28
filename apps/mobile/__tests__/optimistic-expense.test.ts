import { prependExpense, removeExpense } from "../src/expenses/optimistic";
import { testTransaction, transactionPage } from "./helpers/fake-api";

// The budget arithmetic (new balance, daily amount) lives in
// @vireo/shared/budget (addExpenseToSummary); only list bookkeeping is here.

const ids = [1, 2, 3, 4, 5].map((n) => `01923b6e-0000-7000-8000-00000000003${String(n)}`);

describe("prependExpense", () => {
  it("puts the new expense first and keeps the list at 5", () => {
    const page = transactionPage(ids.map((id) => testTransaction({ id })));
    const added = testTransaction({ id: "optimistic-1", amount: 999 });

    const next = prependExpense(page, added);

    expect(next.items).toHaveLength(5);
    expect(next.items[0]).toBe(added);
    expect(next.items.map((t) => t.id)).not.toContain(ids[4]);
  });

  it("works on an empty list", () => {
    const added = testTransaction({ id: "optimistic-1" });

    expect(prependExpense(transactionPage([]), added).items).toEqual([added]);
  });
});

describe("removeExpense", () => {
  it("drops the expense with that id and leaves the rest in order", () => {
    const page = transactionPage(ids.slice(0, 3).map((id) => testTransaction({ id })));

    expect(removeExpense(page, ids[1] ?? "").items.map((t) => t.id)).toEqual([ids[0], ids[2]]);
  });

  it("is a no-op when the id is not on the list", () => {
    const page = transactionPage([testTransaction({ id: ids[0] })]);

    expect(removeExpense(page, "missing").items).toEqual(page.items);
  });
});
