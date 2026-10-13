import { useEffect } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { pl } from "../messages/pl";
import { useOnline } from "./online";

/**
 * "Brak połączenia" over the top of the screen while offline. It covers
 * the status bar area and the space above the screen title, and lets taps
 * through: what was loaded stays readable and usable.
 */
export function OfflineBar() {
  const online = useOnline();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // iOS does not announce a newly shown live region by itself.
    if (!online) AccessibilityInfo.announceForAccessibility(pl.network.offline);
  }, [online]);

  if (online) return null;
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ paddingTop: insets.top }}
      className="absolute left-0 right-0 top-0 items-center bg-foreground px-4 pb-2"
    >
      <Text className="pt-2 font-sans-semibold text-sm text-background">{pl.network.offline}</Text>
    </View>
  );
}
