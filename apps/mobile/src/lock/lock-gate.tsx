import { useEffect, type ReactNode } from "react";
import { AppState, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useLogout } from "../auth/hooks";
import { Button } from "../components/button";
import { pl } from "../messages/pl";
import { appLock, useAppLock } from "./store";

const t = pl.lock;

function LockScreen() {
  const logout = useLogout();
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center gap-4 px-6">
        <Text accessibilityRole="header" className="font-heading text-3xl text-foreground">
          {t.locked}
        </Text>
        <Text className="font-sans text-base text-muted-foreground">{t.lockedHint}</Text>
        <Button onPress={() => void appLock.unlock()}>{t.unlock}</Button>
        {/* The way out when unlocking does not work; the password brings the data back. */}
        <Button
          variant="outline"
          loading={logout.isPending}
          loadingLabel={pl.settings.loggingOut}
          onPress={() => {
            logout.mutate();
          }}
        >
          {pl.settings.logout}
        </Button>
      </View>
    </SafeAreaView>
  );
}

function PhoneLockLostNotice() {
  return (
    <SafeAreaView edges={["bottom", "left", "right"]} className="absolute inset-x-0 bottom-0">
      <View
        accessibilityRole="alert"
        className="m-4 gap-3 rounded-2xl border border-border bg-card p-4"
      >
        <Text className="font-sans text-base text-card-foreground">{t.phoneLockLost}</Text>
        <Button
          variant="outline"
          onPress={() => {
            appLock.dismissNotice();
          }}
        >
          {t.dismiss}
        </Button>
      </View>
    </SafeAreaView>
  );
}

/**
 * Wraps the signed-in app. The app stays mounted under the lock, so after
 * unlocking the user is exactly where they were; while hidden it is also
 * hidden from screen readers.
 */
export function LockGate({ active, children }: { active: boolean; children: ReactNode }) {
  const lock = useAppLock();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      appLock.onAppStateChange(next, Date.now());
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const locked = active && lock.enabled && lock.locked;
  const covered = active && lock.enabled && lock.covered;
  const hidden = locked || covered;

  return (
    <View className="flex-1">
      <View
        className="flex-1"
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {hidden && <View className="absolute inset-0 bg-background">{locked && <LockScreen />}</View>}
      {active && lock.phoneLockLost && <PhoneLockLostNotice />}
    </View>
  );
}
