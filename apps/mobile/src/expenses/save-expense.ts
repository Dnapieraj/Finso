import {
  addExpenseToSummary,
  removeExpenseFromSummary,
  type BudgetSummary,
  type Category,
  type Grosze,
  type TransactionPage,
} from "@vireo/shared";

import { api } from "../api";
import { BUDGET_KEY, RECENT_EXPENSES_KEY } from "../dashboard/queries";
import { queryClient } from "../query-client";
import { dismissNotice, showNotice, type ExpenseNotice } from "./notices";
import { prependExpense, removeExpense } from "./optimistic";

/** What the quick add knows once a category is tapped. */
export interface QuickExpense {
  amount: Grosze;
  /** "Today" in the user's time zone. */
  date: string;
  category: Category;
}

let optimisticIds = 0;

function updateBudget(change: (summary: BudgetSummary) => BudgetSummary) {
  queryClient.setQueryData<BudgetSummary>(BUDGET_KEY, (summary) => summary && change(summary));
}

function updateRecent(change: (page: TransactionPage) => TransactionPage) {
  queryClient.setQueryData<TransactionPage>(RECENT_EXPENSES_KEY, (page) => page && change(page));
}

/** Ask the server for the real numbers once it has settled. */
function refreshFromServer() {
  void queryClient.invalidateQueries({ queryKey: BUDGET_KEY });
  void queryClient.invalidateQueries({ queryKey: ["transactions"] });
}

/**
 * Saves an expense optimistically: the dashboard shows the new balance
 * and the expense at once, the server call runs in the background, and
 * a failure puts the numbers back and offers a retry. A "saved" notice
 * with Cofnij guards against tapping the wrong category.
 */
export async function saveExpense(expense: QuickExpense): Promise<void> {
  optimisticIds += 1;
  const localId = `optimistic-${String(optimisticIds)}`;
  const { amount, date, category } = expense;

  // A refetch in flight would overwrite the optimistic numbers.
  await Promise.all([
    queryClient.cancelQueries({ queryKey: BUDGET_KEY }),
    queryClient.cancelQueries({ queryKey: RECENT_EXPENSES_KEY }),
  ]);
  updateBudget((summary) => addExpenseToSummary(summary, amount));
  updateRecent((page) =>
    prependExpense(page, {
      id: localId,
      amount,
      date,
      categoryId: category.id,
      recurringRuleId: null,
      note: null,
      status: "CONFIRMED",
    }),
  );

  // Undo may be tapped before the server answers; then the delete waits
  // for the id the server hands out.
  const state: { undone: boolean; serverId: string | null } = { undone: false, serverId: null };
  const notice: ExpenseNotice = {
    kind: "saved",
    amount,
    categoryName: category.name,
    undo: () => {
      state.undone = true;
      dismissNotice(notice);
      updateBudget((summary) => removeExpenseFromSummary(summary, amount));
      updateRecent((page) =>
        removeExpense(removeExpense(page, localId), state.serverId ?? localId),
      );
      if (state.serverId !== null) void deleteExpense(state.serverId, amount);
    },
  };
  showNotice(notice);

  try {
    const saved = await api.transactions.create({ amount, date, categoryId: category.id });
    state.serverId = saved.id;
    if (state.undone) {
      await deleteExpense(saved.id, amount);
      return;
    }
    refreshFromServer();
  } catch {
    dismissNotice(notice);
    if (!state.undone) {
      updateBudget((summary) => removeExpenseFromSummary(summary, amount));
      updateRecent((page) => removeExpense(page, localId));
    }
    showNotice({ kind: "save-failed", amount, retry: () => void saveExpense(expense) });
    refreshFromServer();
  }
}

/** Moves a saved expense to the trash; on failure says so and offers a retry. */
async function deleteExpense(id: string, amount: number): Promise<void> {
  try {
    await api.transactions.remove(id);
  } catch {
    showNotice({ kind: "undo-failed", amount, retry: () => void deleteExpense(id, amount) });
  } finally {
    refreshFromServer();
  }
}
