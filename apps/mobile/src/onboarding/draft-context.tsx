import { createContext, useContext, useState, type ReactNode } from "react";

import { emptyDraft, type OnboardingDraft } from "./draft";

type Update = (change: Partial<OnboardingDraft>) => void;

const DraftContext = createContext<readonly [OnboardingDraft, Update] | null>(null);

/**
 * Holds the answers while the user moves between the steps. Lives in the
 * onboarding layout, so it disappears with it: after finishing, and when
 * the app is closed halfway (the next launch starts clean).
 */
export function OnboardingDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(emptyDraft);
  const update: Update = (change) => {
    setDraft((current) => ({ ...current, ...change }));
  };
  return <DraftContext.Provider value={[draft, update]}>{children}</DraftContext.Provider>;
}

/** The answers so far and a way to change them. */
export function useOnboardingDraft(): readonly [OnboardingDraft, Update] {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useOnboardingDraft outside OnboardingDraftProvider");
  return value;
}
