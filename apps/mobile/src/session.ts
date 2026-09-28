import { useSyncExternalStore } from "react";

import type { TokenStore } from "@vireo/shared/api";

import { queryClient } from "./query-client";
import { secureTokenStore } from "./secure-token-store";

/**
 * - `restoring` — reading the secure store at startup (splash screen stays up),
 * - `signed-in` / `signed-out` — decides which route group the guards allow.
 */
export type SessionStatus = "restoring" | "signed-in" | "signed-out";

/** Why the last session ended; the login screen explains the non-obvious ones. */
export type SignOutReason = "logout" | "expired" | "deleted";

/** Snapshot of the session; a new object on every change. */
export interface SessionState {
  readonly status: SessionStatus;
  readonly signOutReason: SignOutReason | null;
}

/** The app's session: what the route guards read and the auth actions update. */
export interface SessionStore {
  getState(): SessionState;
  /** Returns the unsubscribe function, as `useSyncExternalStore` expects. */
  subscribe(listener: () => void): () => void;
  /** Decides the status from the stored refresh token; called on app start. */
  restore(): Promise<void>;
  signedIn(): void;
  /**
   * Switches to signed-out synchronously, so the guards redirect on the
   * next render; the returned promise only covers wiping the tokens.
   */
  signedOut(reason: SignOutReason): Promise<void>;
}

/**
 * Session state kept outside React, because the API client (not a
 * component) is what notices an expired session.
 *
 * The status comes from the refresh token alone, without asking the API:
 * the app opens offline, and a token the server no longer accepts ends the
 * session on the first request anyway (`onSessionExpired`).
 */
export function createSessionStore({
  tokens,
  onSignedOut,
}: {
  tokens: TokenStore;
  /** Drops data cached for the user who just left. */
  onSignedOut: () => void;
}): SessionStore {
  let state: SessionState = { status: "restoring", signOutReason: null };
  const listeners = new Set<() => void>();
  let restoring: Promise<void> | null = null;

  function set(next: SessionState) {
    state = next;
    for (const listener of listeners) listener();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore() {
      // Callers share one read: a second call (React StrictMode runs effects
      // twice in development) must not race the first.
      restoring ??= (async () => {
        set({ status: "restoring", signOutReason: null });
        let refreshToken: string | null = null;
        try {
          refreshToken = await tokens.getRefreshToken();
        } catch {
          // Android can lose the Keystore key (e.g. after a backup restore);
          // the entries are unreadable forever, so start clean.
          await tokens.clear().catch(() => undefined);
        }
        set({ status: refreshToken ? "signed-in" : "signed-out", signOutReason: null });
      })().finally(() => {
        restoring = null;
      });
      return restoring;
    },
    signedIn() {
      set({ status: "signed-in", signOutReason: null });
    },
    signedOut(reason) {
      set({ status: "signed-out", signOutReason: reason });
      onSignedOut();
      // The API client clears them too; this makes sure a restart can never
      // bring back a session the user has left.
      return tokens.clear();
    },
  };
}

/** The app's single session. */
export const session = createSessionStore({
  tokens: secureTokenStore,
  onSignedOut: () => queryClient.clear(),
});

/** Current session state; re-renders when it changes. */
export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState);
}
