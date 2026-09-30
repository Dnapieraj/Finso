import { createContext, useContext, useState, type ReactNode } from "react";

import type { Transaction } from "@vireo/shared";

/**
 * The notice the history shows after an expense went to the trash: with
 * Cofnij, or — when Cofnij failed — with a retry.
 */
export interface ExpenseTrashNotice {
  kind: "deleted" | "restore-failed";
  expense: Transaction;
  /** Its category's name when deleted, for the notice text. */
  categoryName: string | null;
}

type Value = readonly [ExpenseTrashNotice | null, (notice: ExpenseTrashNotice | null) => void];

const NoticeContext = createContext<Value | null>(null);

/**
 * Lives in the signed-in app's layout: the edit screen closes before the
 * history shows the notice, and a new launch starts without one.
 */
export function ExpenseTrashNoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<ExpenseTrashNotice | null>(null);
  return <NoticeContext.Provider value={[notice, setNotice]}>{children}</NoticeContext.Provider>;
}

/** The notice showing and a way to replace or clear it. */
export function useExpenseTrashNotice(): Value {
  const value = useContext(NoticeContext);
  if (!value) throw new Error("useExpenseTrashNotice outside ExpenseTrashNoticeProvider");
  return value;
}
