import { PERIOD_START_DAY_MAX } from "@vireo/shared";
import { Pressable, Text, View } from "react-native";

import { pl } from "../messages/pl";

const DAYS = Array.from({ length: PERIOD_START_DAY_MAX }, (_, i) => i + 1);

function DayChip({
  day,
  selected,
  onPress,
}: {
  day: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={String(day)}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`aspect-square w-[12%] items-center justify-center rounded-xl border ${
        selected ? "border-primary bg-primary" : "border-input bg-background"
      }`}
    >
      <Text
        className={`font-sans-semibold text-base ${
          selected ? "text-primary-foreground" : "text-foreground"
        }`}
      >
        {day}
      </Text>
    </Pressable>
  );
}

/**
 * The payday, 1–28, so the budget period starts on the same day every
 * month (see User.periodStartDay). Used by onboarding and settings.
 */
export function PaydayPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (day: number) => void;
}) {
  return (
    <View className="gap-3">
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={pl.onboarding.payday.days}
        className="flex-row flex-wrap gap-[2.66%] gap-y-2"
      >
        {DAYS.map((day) => (
          <DayChip
            key={day}
            day={day}
            selected={value === day}
            onPress={() => {
              onChange(day);
            }}
          />
        ))}
      </View>
      <Text className="font-sans text-sm text-muted-foreground">
        {pl.onboarding.payday.lateMonthHint}
      </Text>
    </View>
  );
}
