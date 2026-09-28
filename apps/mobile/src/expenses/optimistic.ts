import type { Transaction, TransactionPage } from "@vireo/shared";

/** How many recent expenses the dashboard lists. */
const RECENT_LIMIT = 5;

/**
 * The list with `expense` on top, still at most 5 long — what the
 * dashboard shows the moment an expense is added. The budget arithmetic
 * is not here: that lives in @vireo/shared/budget.
 */
export function prependExpense(page: TransactionPage, expense: Transaction): TransactionPage {
  return { ...page, items: [expense, ...page.items].slice(0, RECENT_LIMIT) };
}

/** The list without the expense `id` — for a failed save or an undo. */
export function removeExpense(page: TransactionPage, id: string): TransactionPage {
  return { ...page, items: page.items.filter((expense) => expense.id !== id) };
}
