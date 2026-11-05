import type { BudgetSummary } from "@vireo/shared";
import { Platform } from "react-native";
import { requestWidgetUpdate, type WidgetTaskHandler } from "react-native-android-widget";

import { budgetWidget, BUDGET_WIDGET } from "./budget-widget";
import { widgetContent, type WidgetSnapshot } from "./content";
import { clearWidgetSnapshot, loadWidgetSnapshot, saveWidgetSnapshot } from "./snapshot-store";

/** Redraws widgets already on the home screen (Android only; no widget = nothing). */
async function redraw(): Promise<void> {
  if (Platform.OS !== "android") return;
  const snapshot = await loadWidgetSnapshot();
  await requestWidgetUpdate({
    widgetName: BUDGET_WIDGET,
    renderWidget: () => budgetWidget(widgetContent(snapshot, new Date())),
  });
}

/** After the budget loaded (or privacy/lock changed): what the widget shows next. */
export async function syncWidget(
  budget: BudgetSummary,
  timeZone: string,
  hidden: boolean,
): Promise<void> {
  const snapshot: WidgetSnapshot = {
    asOf: budget.asOf,
    timeZone,
    periodEnd: budget.period.end,
    available: budget.availableBalance,
    todayLeft: budget.today.left,
    hidden,
  };
  await saveWidgetSnapshot(snapshot);
  await redraw();
}

/** On logout: the widget forgets the amounts and asks to open the app. */
export async function forgetWidget(): Promise<void> {
  await clearWidgetSnapshot();
  await redraw();
}

/**
 * Runs headless when the launcher adds, updates or resizes the widget —
 * from the saved snapshot only: no API, no session needed.
 */
export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, renderWidget }) => {
  if (widgetAction === "WIDGET_DELETED" || widgetAction === "WIDGET_CLICK") return;
  renderWidget(budgetWidget(widgetContent(await loadWidgetSnapshot(), new Date())));
};
