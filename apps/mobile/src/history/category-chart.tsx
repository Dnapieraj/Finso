import { formatMoney, grosze, type Category, type TransactionSummary } from "@vireo/shared";
import { Pressable, Text, View } from "react-native";

import { plural } from "../format/plural";
import { pl } from "../messages/pl";

const t = pl.history;

/** Share of the total, in whole percent. */
function percentOf(amount: number, total: number): number {
  return total > 0 ? Math.round((amount * 100) / total) : 0;
}

/**
 * Spending by category as horizontal bars, largest first.
 *
 * One series (money spent), so every bar has one colour; which category a
 * bar is comes from its label, never from colour. Name, amount and share
 * are text next to the bar — the bar only illustrates them — and each row
 * is one accessible element with that text, so a screen reader reads the
 * data and skips the drawing. Tapping a row filters the list to it.
 */
export function CategoryChart({
  summary,
  categories,
  onSelect,
}: {
  summary: TransactionSummary;
  categories: Category[];
  onSelect: (categoryId: string | null) => void;
}) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const largest = summary.byCategory[0]?.amount ?? 0;

  return (
    <View className="gap-3">
      <Text className="font-sans text-sm text-muted-foreground">
        {t.chart.total(
          // A cost rounds up: the summary never shows less than was spent.
          formatMoney(grosze(summary.total), { whole: "up" }),
          summary.count,
          plural(summary.count, t.chart.expenses),
        )}
      </Text>
      {summary.byCategory.map((line) => {
        const category = line.categoryId ? byId.get(line.categoryId) : undefined;
        const name = category?.name ?? t.noCategory;
        const amount = formatMoney(grosze(line.amount), { whole: "up" });
        const percent = percentOf(line.amount, summary.total);
        const ratio = largest > 0 ? line.amount / largest : 0;
        return (
          <Pressable
            key={line.categoryId ?? "none"}
            accessibilityRole="button"
            accessibilityLabel={t.chart.bar(name, amount, percent)}
            // A bar with no category cannot filter the list: the API filters by an id.
            disabled={line.categoryId === null}
            onPress={() => {
              onSelect(line.categoryId);
            }}
            className="gap-1.5 active:opacity-70"
          >
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="flex-1 font-sans-semibold text-base text-card-foreground">
                {name}
              </Text>
              <Text className="font-sans-semibold text-base text-card-foreground">{amount}</Text>
              <Text className="w-11 text-right font-sans text-sm text-muted-foreground">
                {t.chart.percent(percent)}
              </Text>
            </View>
            <View
              testID="chart-bar"
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              className="h-2 flex-row"
            >
              {/* Two flex parts instead of a width string, as in ProgressBar. */}
              <View className="rounded-full bg-primary" style={{ flex: ratio }} />
              <View style={{ flex: 1 - ratio }} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
