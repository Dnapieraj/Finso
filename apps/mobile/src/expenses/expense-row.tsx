import { grosze, type Category, type Transaction } from "@vireo/shared";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { formatDayMonth } from "../format/date";
import { pl } from "../messages/pl";
import { useMoney } from "../privacy/money";

/**
 * One expense in a list (Start, History): two lines — the note, or the
 * category without one, then „category · date” — and the exact amount.
 * Tapping opens it for editing.
 */
export function ExpenseRow({ expense, category }: { expense: Transaction; category?: Category }) {
  const money = useMoney();
  const name = category?.name ?? pl.history.noCategory;
  const date = formatDayMonth(expense.date);
  // Exact grosze: this is a record of what was paid, not an estimate.
  const amount = money.format(grosze(expense.amount));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={money.spoken(
        [name, date, amount, expense.note].filter(Boolean).join(", "),
      )}
      onPress={() => {
        router.push(`/expense/${expense.id}`);
      }}
      className="flex-row items-center gap-3 py-2 active:opacity-70"
    >
      <View
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: category?.color ?? "transparent" }}
      />
      <View className="flex-1">
        <Text numberOfLines={1} className="font-sans-semibold text-base text-card-foreground">
          {expense.note ?? name}
        </Text>
        <Text numberOfLines={1} className="font-sans text-sm text-muted-foreground">
          {expense.note ? `${name} · ${date}` : date}
        </Text>
      </View>
      <Text className="font-sans-semibold text-base text-card-foreground">{amount}</Text>
    </Pressable>
  );
}
