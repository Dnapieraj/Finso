import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";

import { LoadError, Skeleton } from "../../../../src/components/query-states";
import { Screen } from "../../../../src/components/screen";
import { appLock, useAppLock } from "../../../../src/lock/store";
import { pl } from "../../../../src/messages/pl";
import { BackButton, SwitchRow } from "../../../../src/settings/settings-screen-parts";

const t = pl.lock;

/**
 * Turns the app lock on or off. Without biometrics and without a screen
 * lock code on the phone there is nothing to unlock with, so the switch is
 * off-limits and the screen says what to set up.
 */
export default function LockSettings() {
  const lock = useAppLock();
  const available = useQuery({ queryKey: ["lock", "available"], queryFn: appLock.canEnable });
  const [busy, setBusy] = useState(false);
  const { refetch } = available;

  useEffect(() => {
    // The user may have just set up a screen lock in the phone settings.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refetch();
    });
    return () => {
      subscription.remove();
    };
  }, [refetch]);

  if (available.isPending) {
    return (
      <Screen title={t.title}>
        <Skeleton label={t.title} lines={3} />
      </Screen>
    );
  }
  if (available.isError) {
    return (
      <Screen title={t.title}>
        <LoadError message={t.loadError} onRetry={() => void refetch()} />
        <BackButton />
      </Screen>
    );
  }

  const blocked = !available.data && !lock.enabled;

  async function change(on: boolean) {
    setBusy(true);
    try {
      if (on) await appLock.enable();
      else await appLock.disable();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t.title}>
      {blocked && <Text className="font-sans text-base text-foreground">{t.noScreenLock}</Text>}
      <View className="rounded-2xl bg-card">
        <SwitchRow
          label={t.title}
          value={lock.enabled}
          disabled={blocked || busy}
          onChange={(on) => void change(on)}
        />
      </View>
      <View className="gap-2">
        <Text className="font-sans text-sm text-muted-foreground">{t.what}</Text>
        <Text className="font-sans text-sm text-muted-foreground">{t.privacy}</Text>
        <Text className="font-sans text-sm text-muted-foreground">{t.preview}</Text>
      </View>
      <BackButton />
    </Screen>
  );
}
