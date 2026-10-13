import type { Category, ExpenseTemplate, Transaction } from "@vireo/shared";

/** One tap in the quick add saves this expense as it is. */
export interface QuickPick {
  key: string;
  /** The template's name or the expense's note, else the category. */
  name: string;
  amount: number;
  category: Category;
  note: string | null;
}

const RECENT_SHOWN = 4;

const sameExpense = (amount: number, categoryId: string, note: string | null) =>
  `${String(amount)}|${categoryId}|${note ?? ""}`;

/**
 * Templates first, in the order the user added them, then up to four of
 * the newest different expenses. Recent ones skip what the budget treats
 * differently (fixed payments, „Wydatki przed Finso”), anything without
 * a category the quick add could save under, and repeats of a template.
 */
export function quickPicks(
  templates: ExpenseTemplate[],
  recent: Transaction[],
  categories: Category[],
): QuickPick[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const seen = new Set<string>();
  const picks: QuickPick[] = [];

  for (const template of templates) {
    const category = template.categoryId ? byId.get(template.categoryId) : undefined;
    if (!category) continue;
    seen.add(sameExpense(template.amount, category.id, template.name));
    picks.push({
      key: `template-${template.id}`,
      name: template.name,
      amount: template.amount,
      category,
      note: template.name,
    });
  }

  let recentCount = 0;
  for (const expense of recent) {
    if (recentCount === RECENT_SHOWN) break;
    if (expense.recurringRuleId !== null || expense.beforeFinso) continue;
    const category = expense.categoryId ? byId.get(expense.categoryId) : undefined;
    if (!category) continue;
    const key = sameExpense(expense.amount, category.id, expense.note);
    if (seen.has(key)) continue;
    seen.add(key);
    recentCount += 1;
    picks.push({
      key: `recent-${expense.id}`,
      name: expense.note ?? category.name,
      amount: expense.amount,
      category,
      note: expense.note,
    });
  }
  return picks;
}
