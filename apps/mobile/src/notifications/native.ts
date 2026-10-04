import Constants, { ExecutionEnvironment } from "expo-constants";
import type * as ExpoNotifications from "expo-notifications";
import { Platform } from "react-native";

export type NotificationsModule = typeof ExpoNotifications;

/**
 * Expo Go on Android dropped push support in SDK 53 and now throws as soon
 * as expo-notifications is imported — even for local notifications.
 * Everywhere else (iOS Expo Go, development and store builds) it works.
 */
export function notificationsSupportedOn(os: string, environment: ExecutionEnvironment): boolean {
  return !(os === "android" && environment === ExecutionEnvironment.StoreClient);
}

/**
 * expo-notifications, imported only where it does not throw; `null` in
 * Expo Go on Android, so the rest of the app still runs there.
 */
export async function loadNotifications(): Promise<NotificationsModule | null> {
  if (!notificationsSupportedOn(Platform.OS, Constants.executionEnvironment)) return null;
  return import("expo-notifications");
}
