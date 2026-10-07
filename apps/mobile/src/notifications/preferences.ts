import { useMutation, useQuery } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";

import { queryClient } from "../query-client";
import { loadNotifications } from "./native";
import type { ReminderPreferences } from "./plan";

// On the device, not the account: a second phone may want other reminders.
const PREFERENCES_KEY = "notification-preferences";
/** Set after the in-app question was answered either way — never asked twice. */
const PROMPTED_KEY = "notification-prompted";

export const DEFAULT_PREFERENCES: ReminderPreferences = {
  payday: true,
  payments: true,
  overdue: true,
  showAmounts: false,
};

export const PREFERENCES_QUERY = ["notifications", "preferences"] as const;
export const PERMISSION_QUERY = ["notifications", "permission"] as const;

async function readPreferences(): Promise<ReminderPreferences> {
  const stored = await SecureStore.getItemAsync(PREFERENCES_KEY);
  if (!stored) return DEFAULT_PREFERENCES;
  try {
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(stored) as Partial<ReminderPreferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** The reminder switches; defaults until the user changes one. */
export function useReminderPreferences() {
  return useQuery({ queryKey: PREFERENCES_QUERY, queryFn: readPreferences });
}

/** Saves one switch; the reminder plan follows the cache change. */
export function useSaveReminderPreferences() {
  return useMutation({
    mutationFn: async (change: Partial<ReminderPreferences>) => {
      const next = { ...(await readPreferences()), ...change };
      await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(next));
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(PREFERENCES_QUERY, next);
    },
  });
}

/** `unavailable`: Expo Go on Android, where notifications cannot work at all. */
export type PermissionState = "granted" | "denied" | "undetermined" | "unavailable";

async function readPermission(): Promise<PermissionState> {
  const Notifications = await loadNotifications();
  if (!Notifications) return "unavailable";
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === Notifications.PermissionStatus.GRANTED) return "granted";
  // Android 13+ has no "undetermined": before the first request it reports
  // "denied". Only a refusal that can no longer be asked again is a block.
  return canAskAgain ? "undetermined" : "denied";
}

/** What the system allows; asked again when the app comes back to the front. */
export function useNotificationPermission() {
  return useQuery({ queryKey: PERMISSION_QUERY, queryFn: readPermission });
}

/** Shows the system dialog (once — after a refusal only the phone settings help). */
export async function requestNotificationPermission(): Promise<PermissionState> {
  const Notifications = await loadNotifications();
  if (!Notifications) return "unavailable";
  await Notifications.requestPermissionsAsync();
  const status = await readPermission();
  queryClient.setQueryData(PERMISSION_QUERY, status);
  return status;
}

/** Whether to ask in the app after the first answer on the dashboard card. */
export async function shouldAskForReminders(): Promise<boolean> {
  if ((await SecureStore.getItemAsync(PROMPTED_KEY)) !== null) return false;
  return (await readPermission()) === "undetermined";
}

export async function markRemindersPrompted(): Promise<void> {
  await SecureStore.setItemAsync(PROMPTED_KEY, "1");
}
