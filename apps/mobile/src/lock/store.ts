import * as LocalAuthentication from "expo-local-authentication";
import * as ScreenCapture from "expo-screen-capture";
import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { Platform, type AppStateStatus } from "react-native";

import { pl } from "../messages/pl";
import { shouldLockOnReturn } from "./policy";

export interface AppLockState {
  /** The saved choice has been read since the app started. */
  readonly loaded: boolean;
  readonly enabled: boolean;
  /** Content stays hidden until the phone confirms the owner. */
  readonly locked: boolean;
  /** In the background or the app switcher: content hidden, no unlock needed yet. */
  readonly covered: boolean;
  /** The lock turned itself off because the phone no longer has a screen lock. */
  readonly phoneLockLost: boolean;
}

// On the device, not the account: logging out turns it off anyway.
const STORAGE_KEY = "app-lock";
const SCREEN_CAPTURE_KEY = "app-lock";

let state: AppLockState = {
  loaded: false,
  enabled: false,
  locked: false,
  covered: false,
  phoneLockLost: false,
};
let backgroundedAt: number | null = null;
/**
 * While the system prompt is up the app may go "inactive" (iOS) or to the
 * background (Android opens its code screen as a separate window); that
 * must neither cover the app nor count as time away.
 */
let authenticating = false;
const listeners = new Set<() => void>();

function set(change: Partial<AppLockState>) {
  state = { ...state, ...change };
  for (const listener of listeners) listener();
}

/**
 * Hides the app's preview in the app switcher. Android does it with
 * FLAG_SECURE, which also blanks screenshots; iOS blurs the snapshot.
 * A failure only loses the hidden preview, never the lock itself.
 */
async function hidePreview(hidden: boolean): Promise<void> {
  try {
    if (hidden) {
      await ScreenCapture.preventScreenCaptureAsync(SCREEN_CAPTURE_KEY);
      if (Platform.OS === "ios") await ScreenCapture.enableAppSwitcherProtectionAsync();
    } else {
      await ScreenCapture.allowScreenCaptureAsync(SCREEN_CAPTURE_KEY);
      if (Platform.OS === "ios") await ScreenCapture.disableAppSwitcherProtectionAsync();
    }
  } catch {
    // Expo Go or an old OS without the API.
  }
}

/** Biometrics or the phone's screen lock code; NONE means neither is set up. */
async function phoneHasScreenLock(): Promise<boolean> {
  try {
    return (
      (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE
    );
  } catch {
    return false;
  }
}

/**
 * The system prompt; the app only learns whether it succeeded. The phone's
 * code is the fallback, so there is no PIN of Finso's own to store or reset.
 */
async function authenticate(): Promise<boolean> {
  authenticating = true;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: pl.lock.prompt,
      cancelLabel: pl.lock.cancel,
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  } finally {
    authenticating = false;
  }
}

async function turnOff(change: Partial<AppLockState> = {}): Promise<void> {
  backgroundedAt = null;
  set({ enabled: false, locked: false, covered: false, ...change });
  await SecureStore.deleteItemAsync(STORAGE_KEY);
  await hidePreview(false);
}

/** Without a screen lock on the phone nobody could unlock, the owner included. */
async function lostPhoneLock(): Promise<void> {
  await turnOff({ phoneLockLost: true });
}

/**
 * The app lock, kept outside React: the root layout needs it before the
 * splash screen hides, and the session turns it off on logout.
 */
export const appLock = {
  get: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Reads the saved choice at app start; a saved lock starts locked. */
  async load(): Promise<void> {
    let saved = false;
    try {
      saved = (await SecureStore.getItemAsync(STORAGE_KEY)) === "on";
    } catch {
      // Unreadable storage: the session restore starts clean in that case too.
    }
    // A fresh start: nothing is covered and no time away is pending.
    backgroundedAt = null;
    if (saved && !(await phoneHasScreenLock())) {
      await lostPhoneLock();
      set({ loaded: true });
      return;
    }
    set({ loaded: true, enabled: saved, locked: false, covered: false, phoneLockLost: false });
    await hidePreview(saved);
    if (saved) appLock.lock();
  },

  /** Whether the phone can lock the app at all (biometrics or a code). */
  canEnable: phoneHasScreenLock,

  /** Turns the lock on only after one successful unlock, so it is known to work. */
  async enable(): Promise<boolean> {
    if (!(await authenticate())) return false;
    await SecureStore.setItemAsync(STORAGE_KEY, "on");
    set({ enabled: true, phoneLockLost: false });
    await hidePreview(true);
    return true;
  },

  /** No unlock needed: whoever can reach the switch is already inside. */
  disable: () => turnOff(),

  /** Hides the content and shows the system prompt right away. */
  lock(): void {
    set({ locked: true, covered: false });
    void appLock.unlock();
  },

  async unlock(): Promise<void> {
    if (authenticating || !state.locked) return;
    if (await authenticate()) {
      set({ locked: false });
      return;
    }
    // A failed prompt on a phone that lost its screen lock would never pass.
    if (!(await phoneHasScreenLock())) await lostPhoneLock();
  },

  /**
   * Follows the app between foreground and background. Safe to call more
   * than once per change: only the first background moment counts.
   */
  onAppStateChange(next: AppStateStatus, now: number): void {
    if (!state.enabled || authenticating) return;
    if (next === "active") {
      const away = backgroundedAt;
      backgroundedAt = null;
      if (shouldLockOnReturn({ backgroundedAt: away, now })) appLock.lock();
      else if (state.covered) set({ covered: false });
      return;
    }
    if (next === "background") backgroundedAt ??= now;
    if (!state.covered) set({ covered: true });
  },

  dismissNotice(): void {
    set({ phoneLockLost: false });
  },
};

/** The lock's state; re-renders when it changes. */
export function useAppLock(): AppLockState {
  return useSyncExternalStore(appLock.subscribe, appLock.get);
}
