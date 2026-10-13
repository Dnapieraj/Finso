import * as Haptics from "expo-haptics";

import { devicePreferences } from "../preferences/device-preferences";

/** A vibration is a nicety: a phone without the motor must not break a save. */
function feel(vibrate: () => Promise<void>): void {
  if (!devicePreferences.get().haptics) return;
  vibrate().catch(() => undefined);
}

/**
 * Feedback the user feels: a light tap when something is saved, the system's
 * error pattern when it is not. Module functions, not a hook, because the
 * quick add saves after its screen has closed.
 */
export const haptics = {
  saved: () => {
    feel(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  failed: () => {
    feel(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
};
