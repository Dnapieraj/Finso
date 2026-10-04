import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useConfirmations } from "../confirmations/queries";
import { useBudget } from "../dashboard/queries";
import { queryClient } from "../query-client";
import { useIncomeSources, useRecurringRules } from "../settings/queries";
import { planReminders } from "./plan";
import { PERMISSION_QUERY, useNotificationPermission, useReminderPreferences } from "./preferences";
import { replaceReminders } from "./schedule";

/**
 * Keeps the reminders the phone holds in line with what the app knows.
 * The plan is rebuilt from cached queries, so any change — an answer on
 * the card, a new commitment, a switch in settings — reschedules it.
 */
export function ReminderSync() {
  const permission = useNotificationPermission();
  const preferences = useReminderPreferences();
  const budget = useBudget();
  const sources = useIncomeSources();
  const rules = useRecurringRules();
  const due = useConfirmations();

  const granted = permission.data === "granted";
  const lastPlan = useRef<string | null>(null);

  // Query data keeps its identity until it really changes, so this runs on
  // a real change only; the comparison below skips plans that came out the same.
  useEffect(() => {
    if (!granted || !preferences.data || !budget.data || !sources.data) return;
    if (!rules.data || !due.data) return;
    const plan = planReminders({
      today: budget.data.asOf,
      now: new Date(),
      incomeSources: sources.data,
      rules: rules.data,
      due: due.data,
      preferences: preferences.data,
    });
    const key = JSON.stringify(plan);
    if (key === lastPlan.current) return;
    lastPlan.current = key;
    void replaceReminders(plan);
  }, [granted, preferences.data, budget.data, sources.data, rules.data, due.data]);

  useEffect(() => {
    // The user may have allowed or blocked notifications in the phone settings.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void queryClient.invalidateQueries({ queryKey: PERMISSION_QUERY });
    });
    // Every reminder is about something to answer on the dashboard.
    const taps = Notifications.addNotificationResponseReceivedListener(() => {
      router.navigate("/");
    });
    return () => {
      appState.remove();
      taps.remove();
    };
  }, []);

  return null;
}
