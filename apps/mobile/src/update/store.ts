import { useSyncExternalStore } from "react";

/**
 * Whether the API said this app version is too old (HTTP 426). Outside
 * React, like the session: the API client — not a component — notices it.
 * Stays set until the app restarts; only an update clears it.
 */
function createUpdateRequiredStore() {
  let required = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    get: () => required,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: () => {
      if (required) return;
      required = true;
      notify();
    },
    /** Tests only: a fresh app start. */
    reset: () => {
      required = false;
      notify();
    },
  };
}

export const updateRequired = createUpdateRequiredStore();

/** True once any API response was 426. */
export function useUpdateRequired(): boolean {
  return useSyncExternalStore(updateRequired.subscribe, updateRequired.get);
}
