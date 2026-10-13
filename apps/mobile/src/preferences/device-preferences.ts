import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";

export interface DevicePreferences {
  /** Privacy mode: amounts show as "•••" until the eye is tapped again. */
  hideAmounts: boolean;
  /** A light tap on save, a different one on an error. */
  haptics: boolean;
}

// On the device, not the account: hiding amounts is about who is looking at
// this phone, and logging out does not change who that is.
const STORAGE_KEY = "device-preferences";
const DEFAULTS: DevicePreferences = { hideAmounts: false, haptics: true };

let preferences = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

/**
 * Kept outside React like the appearance: the root layout waits for it, so
 * hidden amounts never flash on screen before the saved choice is read.
 */
export const devicePreferences = {
  get: () => preferences,
  isLoaded: () => loaded,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Reads the saved choice; a broken or missing entry means the defaults. */
  async load(): Promise<void> {
    let stored: Partial<Record<keyof DevicePreferences, unknown>> = {};
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw) as typeof stored;
    } catch {
      // Unreadable storage is not worth blocking the app for.
    }
    preferences = {
      hideAmounts: asBoolean(stored.hideAmounts, DEFAULTS.hideAmounts),
      haptics: asBoolean(stored.haptics, DEFAULTS.haptics),
    };
    loaded = true;
    emit();
  },
  /** Applies at once, then saves. */
  async set(change: Partial<DevicePreferences>): Promise<void> {
    preferences = { ...preferences, ...change };
    emit();
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(preferences));
  },
};

/** The current preferences; re-renders when they change. */
export function useDevicePreferences(): DevicePreferences {
  return useSyncExternalStore(devicePreferences.subscribe, devicePreferences.get);
}

/** Whether the saved preferences have been read since the app started. */
export function useDevicePreferencesLoaded(): boolean {
  return useSyncExternalStore(devicePreferences.subscribe, devicePreferences.isLoaded);
}
