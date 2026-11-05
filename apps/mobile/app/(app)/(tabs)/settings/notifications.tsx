import { Linking, Pressable, Text, View } from "react-native";

import { Button } from "../../../../src/components/button";
import { LoadError, Skeleton } from "../../../../src/components/query-states";
import { Screen } from "../../../../src/components/screen";
import { pl } from "../../../../src/messages/pl";
import { REMINDER_HOURS, type ReminderPreferences } from "../../../../src/notifications/plan";
import {
  requestNotificationPermission,
  useNotificationPermission,
  useReminderPreferences,
  useSaveReminderPreferences,
} from "../../../../src/notifications/preferences";
import { SwitchRow } from "../../../../src/settings/settings-screen-parts";

const t = pl.notifications;

const KINDS = [
  ["payday", t.payday],
  ["payments", t.payments],
  ["overdue", t.overdue],
] as const satisfies readonly (readonly [keyof ReminderPreferences, string])[];

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
      <Screen back title={t.title}>
        <Skeleton label={t.title} lines={4} />
      </Screen>
    );
  }
  if (permission.isError || preferences.isError) {
    return (
      <Screen back title={t.title}>
        <LoadError
          message={t.loadError}
          onRetry={() => {
            void permission.refetch();
            void preferences.refetch();
          }}
        />
      </Screen>
    );
  }

  const granted = permission.data === "granted";
  const blocked = permission.data === "denied";
  const unavailable = permission.data === "unavailable";
  const prefs = preferences.data;

  async function change(key: Exclude<keyof ReminderPreferences, "hour">, value: boolean) {
    if (value && permission.data === "undetermined") {
      if ((await requestNotificationPermission()) !== "granted") return;
    }
    save.save({ [key]: value });
  }

  return (
    <Screen back title={t.title}>
      {unavailable && <Text className="font-sans text-base text-foreground">{t.unavailable}</Text>}
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
            disabled={blocked || unavailable}
            onChange={(value) => void change(key, value)}
          />
        ))}
      </View>
      <View className="rounded-2xl bg-card">
        <SwitchRow
          label={t.showAmounts}
          hint={t.showAmountsHint}
          value={granted && prefs.showAmounts}
          disabled={blocked || unavailable}
          onChange={(value) => void change("showAmounts", value)}
        />
      </View>
      <HourStepper
        hour={prefs.hour}
        disabled={blocked || unavailable}
        onStep={(step) => {
          // From the cached value, not this render: quick taps add up.
          save.save((current) => ({
            hour: Math.min(REMINDER_HOURS.max, Math.max(REMINDER_HOURS.min, current.hour + step)),
          }));
        }}
      />
      <Text className="font-sans text-sm text-muted-foreground">
        {t.time(t.hourValue(prefs.hour))}
      </Text>
    </Screen>
  );
}

/**
 * The hour every reminder comes at, an hour at a time. One adjustable
 * element for screen readers (swipe up/down), two buttons for touch.
 */
function HourStepper({
  hour,
  disabled,
  onStep,
}: {
  hour: number;
  disabled: boolean;
  onStep: (step: 1 | -1) => void;
}) {
  const canEarlier = !disabled && hour > REMINDER_HOURS.min;
  const canLater = !disabled && hour < REMINDER_HOURS.max;
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t.hour}
        accessibilityValue={{ text: t.hourValue(hour) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment" && canLater) onStep(1);
          if (event.nativeEvent.actionName === "decrement" && canEarlier) onStep(-1);
        }}
        className="shrink gap-0.5"
      >
        <Text className="font-sans-semibold text-base text-card-foreground">{t.hour}</Text>
        <Text className="font-sans text-base text-muted-foreground">{t.hourValue(hour)}</Text>
      </View>
      <View className="flex-row gap-2">
        <StepButton
          label={t.earlier}
          symbol="−"
          enabled={canEarlier}
          onPress={() => {
            onStep(-1);
          }}
        />
        <StepButton
          label={t.later}
          symbol="+"
          enabled={canLater}
          onPress={() => {
            onStep(1);
          }}
        />
      </View>
    </View>
  );
}

function StepButton({
  label,
  symbol,
  enabled,
  onPress,
}: {
  label: string;
  symbol: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      className={`h-12 w-12 items-center justify-center rounded-full border border-input active:opacity-70 ${enabled ? "" : "opacity-40"}`}
    >
      <Text className="font-sans-semibold text-xl text-foreground">{symbol}</Text>
    </Pressable>
  );
}
