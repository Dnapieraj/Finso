import { useSyncExternalStore } from "react";

/**
 * The one notice the dashboard shows after a quick add. It lives outside
 * React because the add-expense screen closes before the save finishes.
 */
export type ExpenseNotice =
  | { kind: "saved"; amount: number; categoryName: string; undo: () => void }
  | { kind: "save-failed"; amount: number; retry: () => void }
  | { kind: "undo-failed"; amount: number; retry: () => void };

let current: ExpenseNotice | null = null;
const listeners = new Set<() => void>();

/** Replaces whatever notice is showing. */
export function showNotice(notice: ExpenseNotice | null): void {
  current = notice;
  for (const listener of listeners) listener();
}

/** Clears `notice` only if it is still the one showing (a newer one wins). */
export function dismissNotice(notice: ExpenseNotice): void {
  if (current === notice) showNotice(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The notice to show, re-rendering when it changes. */
export function useExpenseNotice(): ExpenseNotice | null {
  return useSyncExternalStore(subscribe, () => current);
}
