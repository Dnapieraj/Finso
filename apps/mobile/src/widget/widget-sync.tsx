import { useEffect } from "react";
import { useSyncExternalStore } from "react";

import { useAccount } from "../auth/account";
import { useBudget } from "../dashboard/queries";
import { appLock } from "../lock/store";
import { devicePreferences } from "../preferences/device-preferences";
import { syncWidget } from "./update";

/**
 * Keeps the home screen widget in line with the app: every loaded budget,
 * and a switch of privacy mode or the app lock, saves what the widget
 * shows next. The amount is hidden whenever either is on — the home screen
 * is visible to anyone holding the phone.
 */
export function WidgetSync() {
  const budget = useBudget();
  const account = useAccount();
  const { hideAmounts } = useSyncExternalStore(devicePreferences.subscribe, devicePreferences.get);
  const { enabled: locked } = useSyncExternalStore(appLock.subscribe, appLock.get);

  useEffect(() => {
    if (!budget.data) return;
    void syncWidget(budget.data, account.timezone, hideAmounts || locked);
  }, [budget.data, account.timezone, hideAmounts, locked]);

  return null;
}
