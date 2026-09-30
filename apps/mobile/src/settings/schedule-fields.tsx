import { Pressable, Text, View } from "react-native";

import { TextField } from "../components/text-field";
import { pl } from "../messages/pl";
import { FieldError } from "../onboarding/step";
import type { Cadence, ScheduleErrors, ScheduleFields as Fields } from "./schedule";

const t = pl.budgetSettings.schedule;

/** Monday first, as Polish calendars show the week. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const CADENCES: [Cadence, string][] = [
  ["MONTHLY", t.monthly],
  ["BIWEEKLY", t.biweekly],
  ["WEEKLY", t.weekly],
];

/** A small radio pill; `label` is what screen readers read and tests find. */
export function Pill({
  label,
  text = label,
  selected,
  onPress,
}: {
  label: string;
  text?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-11 items-center justify-center rounded-full border px-4 ${
        selected ? "border-primary bg-primary" : "border-input bg-background"
      }`}
    >
      <Text
        className={`font-sans-semibold text-sm ${
          selected ? "text-primary-foreground" : "text-foreground"
        }`}
      >
        {text}
      </Text>
    </Pressable>
  );
}

/** How often and on which day: every month, every 2 weeks or every week. */
export function ScheduleFields({
  value,
  errors,
  onChange,
}: {
  value: Fields;
  errors: ScheduleErrors;
  onChange: (change: Partial<Fields>) => void;
}) {
  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="font-sans-semibold text-sm text-foreground">{t.frequency}</Text>
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
          {CADENCES.map(([cadence, label]) => (
            <Pill
              key={cadence}
              label={label}
              selected={value.cadence === cadence}
              onPress={() => {
                onChange({ cadence });
              }}
            />
          ))}
        </View>
      </View>

      {value.cadence === "MONTHLY" ? (
        <TextField
          label={t.dayOfMonth}
          hint={t.dayOfMonthHint}
          value={value.dayOfMonth}
          onChangeText={(dayOfMonth) => {
            onChange({ dayOfMonth });
          }}
          error={errors.dayOfMonth}
          keyboardType="number-pad"
        />
      ) : (
        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-foreground">{t.weekday}</Text>
          <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
            {WEEK_ORDER.map((day) => (
              <Pill
                key={day}
                label={t.weekdays[day] ?? ""}
                text={(t.weekdays[day] ?? "").slice(0, 3)}
                selected={value.dayOfWeek === day}
                onPress={() => {
                  onChange({ dayOfWeek: day });
                }}
              />
            ))}
          </View>
          <FieldError>{errors.dayOfWeek}</FieldError>
        </View>
      )}

      {value.cadence === "BIWEEKLY" && (
        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-foreground">{t.week}</Text>
          <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
            <Pill
              label={t.thisWeek}
              selected={value.week === "this"}
              onPress={() => {
                onChange({ week: "this" });
              }}
            />
            <Pill
              label={t.nextWeek}
              selected={value.week === "next"}
              onPress={() => {
                onChange({ week: "next" });
              }}
            />
          </View>
          <FieldError>{errors.week}</FieldError>
        </View>
      )}
    </View>
  );
}
