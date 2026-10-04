import { Platform } from "react-native";

import { pl } from "../messages/pl";
import { loadNotifications, type NotificationsModule } from "./native";
import type { Reminder } from "./plan";

const CHANNEL_ID = "reminders";

// Replacing the plan is cancel-all then schedule-each; two replacements at
// once would interleave and leave duplicates, so they run one after another.
let queue: Promise<void> = Promise.resolve();

function enqueue(job: () => Promise<void>): Promise<void> {
  queue = queue.then(job, job);
  return queue;
}

let handlerSet = false;

/** Shown while the app is open too: the reminder may be about another screen. */
function showWhileOpen(Notifications: NotificationsModule) {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
  });
}

/** Replaces everything scheduled with `reminders`. */
export function replaceReminders(reminders: readonly Reminder[]): Promise<void> {
  return enqueue(async () => {
    const Notifications = await loadNotifications();
    if (!Notifications) return;
    showWhileOpen(Notifications);
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: pl.notifications.channel,
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const reminder of reminders) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: { title: reminder.title, body: reminder.body, data: { url: "/" } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.at,
          channelId: CHANNEL_ID,
        },
      });
    }
  });
}

/** After logout: reminders name the user's payments and must not stay behind. */
export function cancelReminders(): Promise<void> {
  return enqueue(async () => {
    const Notifications = await loadNotifications();
    await Notifications?.cancelAllScheduledNotificationsAsync();
  });
}
