import { theme } from "@vireo/tokens";
import { Linking, Switch, Text, useColorScheme, View } from "react-native";

import { Button } from "../../../../src/components/button";
import { LoadError, Skeleton } from "../../../../src/components/query-states";
import { Screen } from "../../../../src/components/screen";
import { pl } from "../../../../src/messages/pl";
import type { ReminderPreferences } from "../../../../src/notifications/plan";
import {
  requestNotificationPermission,
  useNotificationPermission,
  useReminderPreferences,
  useSaveReminderPreferences,
} from "../../../../src/notifications/preferences";
import { BackButton } from "../../../../src/settings/settings-screen-parts";

const t = pl.notifications;

const KINDS = [
  ["payday", t.payday],
  ["payments", t.payments],
  ["overdue", t.overdue],
] as const satisfies readonly (readonly [keyof ReminderPreferences, string])[];

function SwitchRow({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const colors = theme.colors[useColorScheme() === "dark" ? "dark" : "light"];
  return (
    <View className="min-h-12 flex-row items-center justify-between gap-3 px-4 py-3">
      <View className="shrink gap-0.5">
        <Text className="font-sans-semibold text-base text-card-foreground">{label}</Text>
        {hint && <Text className="font-sans text-sm text-muted-foreground">{hint}</Text>}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled, checked: value }}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.input }}
      />
    </View>
  );
}

/**
 * Which reminders the phone shows. A switch reads "on" only when the
 * system allows notifications too, so it never promises what the phone
 * would block. Turning one on before any decision asks for permission.
 */
export default function NotificationSettings() {
  const permission = useNotificationPermission();
  const preferences = useReminderPreferences();
  const save = useSaveReminderPreferences();

  if (permission.isPending || preferences.isPending) {
    return (
      <Screen title={t.title}>
        <Skeleton label={t.title} lines={4} />
      </Screen>
    );
  }
  if (permission.isError || preferences.isError) {
    return (
      <Screen title={t.title}>
        <LoadError
          message={t.loadError}
          onRetry={() => {
            void permission.refetch();
            void preferences.refetch();
          }}
        />
        <BackButton />
      </Screen>
    );
  }

  const granted = permission.data === "granted";
  const blocked = permission.data === "denied";
  const prefs = preferences.data;

  async function change(key: keyof ReminderPreferences, value: boolean) {
    if (value && permission.data === "undetermined") {
      if ((await requestNotificationPermission()) !== "granted") return;
    }
    save.mutate({ [key]: value });
  }

  return (
    <Screen title={t.title}>
      {blocked && (
        <View className="gap-3">
          <Text className="font-sans text-base text-foreground">{t.blocked}</Text>
          <Button variant="outline" onPress={() => void Linking.openSettings()}>
            {t.openSystemSettings}
          </Button>
        </View>
      )}
      <View className="divide-y divide-border rounded-2xl bg-card">
        {KINDS.map(([key, label]) => (
          <SwitchRow
            key={key}
            label={label}
            value={granted && prefs[key]}
            disabled={blocked}
            onChange={(value) => void change(key, value)}
          />
        ))}
      </View>
      <View className="rounded-2xl bg-card">
        <SwitchRow
          label={t.showAmounts}
          hint={t.showAmountsHint}
          value={granted && prefs.showAmounts}
          disabled={blocked}
          onChange={(value) => void change("showAmounts", value)}
        />
      </View>
      <Text className="font-sans text-sm text-muted-foreground">{t.time}</Text>
      <BackButton />
    </Screen>
  );
}
