/**
 * In-memory stand-in for expo-notifications: the OS notification centre
 * does not exist under Jest. Tests set the permission the user gave,
 * read what is scheduled and simulate a tap on a notification.
 */
type PermissionStatus = "granted" | "denied" | "undetermined";

interface Scheduled {
  identifier: string;
  content: { title: string; body: string; data?: Record<string, unknown> };
  trigger: { type: string; date: Date; channelId?: string };
}

interface Response {
  notification: { request: { identifier: string; content: Scheduled["content"] } };
  actionIdentifier: string;
}

let permission: PermissionStatus = "undetermined";
/** What the system dialog answers when the app asks. */
let dialogAnswer: PermissionStatus = "granted";
let pending: Scheduled[] = [];
const responseListeners = new Set<(response: Response) => void>();

const permissionResult = () => ({
  status: permission,
  granted: permission === "granted",
  canAskAgain: permission === "undetermined",
  expires: "never",
});

export const SchedulableTriggerInputTypes = { DATE: "date" } as const;
export const AndroidImportance = { DEFAULT: 3, HIGH: 4 } as const;
export const DEFAULT_ACTION_IDENTIFIER = "expo.modules.notifications.actions.DEFAULT";

export const setNotificationHandler = jest.fn();
export const setNotificationChannelAsync = jest.fn(() => Promise.resolve(null));
export const getPermissionsAsync = jest.fn(() => Promise.resolve(permissionResult()));
export const requestPermissionsAsync = jest.fn(() => {
  if (permission === "undetermined") permission = dialogAnswer;
  return Promise.resolve(permissionResult());
});
export const scheduleNotificationAsync = jest.fn(
  (request: Omit<Scheduled, "identifier"> & { identifier?: string }) => {
    const identifier = request.identifier ?? `n${String(pending.length)}`;
    pending = [...pending.filter((n) => n.identifier !== identifier), { ...request, identifier }];
    return Promise.resolve(identifier);
  },
);
export const cancelAllScheduledNotificationsAsync = jest.fn(() => {
  pending = [];
  return Promise.resolve();
});
export const getAllScheduledNotificationsAsync = jest.fn(() => Promise.resolve([...pending]));
export const getLastNotificationResponseAsync = jest.fn(() => Promise.resolve(null));
export const addNotificationResponseReceivedListener = jest.fn(
  (listener: (response: Response) => void) => {
    responseListeners.add(listener);
    return { remove: () => responseListeners.delete(listener) };
  },
);

/** The permission as if the user had already answered the system dialog. */
export function setPermission(status: PermissionStatus): void {
  permission = status;
}

/** How the user will answer the system dialog when the app asks. */
export function answerDialogWith(status: "granted" | "denied"): void {
  dialogAnswer = status;
}

/** Notifications waiting in the OS, earliest first. */
export function scheduled(): Scheduled[] {
  return [...pending].sort((a, b) => a.trigger.date.getTime() - b.trigger.date.getTime());
}

/** The user taps a notification in the system tray. */
export function tapNotification(identifier: string): void {
  const notification = pending.find((n) => n.identifier === identifier);
  if (!notification) throw new Error(`No scheduled notification ${identifier}`);
  for (const listener of responseListeners) {
    listener({
      notification: { request: { identifier, content: notification.content } },
      actionIdentifier: DEFAULT_ACTION_IDENTIFIER,
    });
  }
}

export function resetNotifications(): void {
  permission = "undetermined";
  dialogAnswer = "granted";
  pending = [];
  responseListeners.clear();
}
