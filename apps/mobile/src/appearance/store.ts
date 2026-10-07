import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";

/** "system" follows the phone; the others override it. */
export type TextSize = "system" | "large" | "xlarge";
export type ThemeChoice = "system" | "light" | "dark";

export interface AppearanceSettings {
  textSize: TextSize;
  theme: ThemeChoice;
}

/**
 * Multipliers on top of the phone's own font size (React Native applies
 * that one by itself), so "Bardzo duży" on a phone already at its largest
 * size is larger still. Only text grows: spacing and icons stay.
 */
export const TEXT_SCALES: Record<TextSize, number> = { system: 1, large: 1.15, xlarge: 1.3 };

// On the device, not the account: a second phone may need other settings.
const STORAGE_KEY = "appearance";
const DEFAULTS: AppearanceSettings = { textSize: "system", theme: "system" };

let settings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function isTextSize(value: unknown): value is TextSize {
  return value === "system" || value === "large" || value === "xlarge";
}

function isTheme(value: unknown): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Appearance kept outside React: the root layout needs it before the
 * splash screen hides, so the app never flashes in the wrong palette.
 */
export const appearance = {
  get: () => settings,
  isLoaded: () => loaded,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Reads the saved choice; a broken or missing entry means the defaults. */
  async load(): Promise<void> {
    let stored: Partial<Record<keyof AppearanceSettings, unknown>> = {};
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw) as typeof stored;
    } catch {
      // Unreadable storage is not worth blocking the app for.
    }
    settings = {
      textSize: isTextSize(stored.textSize) ? stored.textSize : DEFAULTS.textSize,
      theme: isTheme(stored.theme) ? stored.theme : DEFAULTS.theme,
    };
    loaded = true;
    emit();
  },
  /** Applies at once (the preview is live), then saves. */
  async set(change: Partial<AppearanceSettings>): Promise<void> {
    settings = { ...settings, ...change };
    emit();
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(settings));
  },
};

/** The current appearance; re-renders when it changes. */
export function useAppearance(): AppearanceSettings {
  return useSyncExternalStore(appearance.subscribe, appearance.get);
}

/** Whether the saved appearance has been read since the app started. */
export function useAppearanceLoaded(): boolean {
  return useSyncExternalStore(appearance.subscribe, appearance.isLoaded);
}
