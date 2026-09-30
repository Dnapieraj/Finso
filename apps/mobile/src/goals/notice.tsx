import { createContext, useContext, useState, type ReactNode } from "react";

import type { Goal } from "@vireo/shared";

/**
 * The notice the goals list shows after a goal went to the trash: with
 * Cofnij, or — when Cofnij failed — with a retry.
 */
export interface GoalNotice {
  kind: "deleted" | "restore-failed";
  goal: Goal;
}

type Value = readonly [GoalNotice | null, (notice: GoalNotice | null) => void];

const NoticeContext = createContext<Value | null>(null);

/**
 * Lives in the goals tab's layout: the edit screen closes before the list
 * shows the notice, and a new launch starts without one.
 */
export function GoalNoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<GoalNotice | null>(null);
  return <NoticeContext.Provider value={[notice, setNotice]}>{children}</NoticeContext.Provider>;
}

/** The notice showing and a way to replace or clear it. */
export function useGoalNotice(): Value {
  const value = useContext(NoticeContext);
  if (!value) throw new Error("useGoalNotice outside GoalNoticeProvider");
  return value;
}
