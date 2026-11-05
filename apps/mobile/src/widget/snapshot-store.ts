import * as SecureStore from "expo-secure-store";

import type { WidgetSnapshot } from "./content";

// In the secure store like the session: the widget needs it while the app is
// closed, and amounts are private even when they are only cached.
const STORAGE_KEY = "widget-snapshot";

/** What the widget shows next; `null` = nothing (signed out, never loaded). */
export async function loadWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    // An unreadable entry is the same as none: the widget asks to open the app.
    return null;
  }
}

export async function saveWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(snapshot));
}

export async function clearWidgetSnapshot(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
