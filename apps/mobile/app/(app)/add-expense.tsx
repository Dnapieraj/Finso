import { grosze, parseMoneyInput, todayInTimeZone, type Category } from "@vireo/shared";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Button } from "../../src/components/button";
import { LoadError, Skeleton } from "../../src/components/query-states";
import { Screen } from "../../src/components/screen";
import { TextField } from "../../src/components/text-field";
import { useBudget, useCategories } from "../../src/dashboard/queries";
import { CategoryIcon } from "../../src/expenses/category-icon";
import { quickPicks, type QuickPick } from "../../src/expenses/quick-picks";
import { saveExpense } from "../../src/expenses/save-expense";
import { pl } from "../../src/messages/pl";
import { useMoney } from "../../src/privacy/money";
import { useRecentForPicks, useTemplates } from "../../src/templates/queries";

const t = pl.addExpense;

function CategoryTile({ category, onPress }: { category: Category; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={category.name}
      onPress={onPress}
      className="w-[31%] items-center gap-2 rounded-2xl border border-border bg-card px-2 py-3 active:opacity-70"
    >
      {/* The category colour is decoration only; the name carries the
          meaning in a token colour that passes AA. */}
      <View
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: category.color }}
      >
        <CategoryIcon icon={category.icon} color="#FFFFFF" size={22} />
      </View>
      <Text
        numberOfLines={1}
        className="text-center font-sans-semibold text-sm text-card-foreground"
      >
        {category.name}
      </Text>
    </Pressable>
  );
}

/** A template or a recent expense: one tap saves it again, dated today. */
function QuickPickChip({ pick, onPress }: { pick: QuickPick; onPress: () => void }) {
  const money = useMoney();
  // Exact grosze: this is exactly the amount that gets saved.
  const amount = money.format(grosze(pick.amount));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={money.spoken(`${pick.name}, ${amount}`)}
      onPress={onPress}
      className="max-w-full flex-row items-center gap-2 rounded-full border border-border bg-card py-2 pl-2 pr-4 active:opacity-70"
    >
      <View
        className="h-7 w-7 items-center justify-center rounded-full"
        style={{ backgroundColor: pick.category.color }}
      >
        <CategoryIcon icon={pick.category.icon} color="#FFFFFF" size={16} />
      </View>
      <Text numberOfLines={1} className="shrink font-sans-semibold text-sm text-card-foreground">
        {pick.name}
      </Text>
      <Text className="font-sans text-sm text-muted-foreground">{amount}</Text>
    </Pressable>
  );
}

/**
 * Quick add in three interactions: "+" on the dashboard, the amount (the
 * field is focused on open), a category tap — which saves and closes.
 * Templates and recent expenses above the categories save in one tap.
 * The save runs on after the screen closes (src/expenses/save-expense).
 */
export default function AddExpenseScreen() {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | undefined>();
  const categories = useCategories();
  const budget = useBudget();
  // Neither blocks the quick add: while they load, or if they fail, the
  // categories work as always.
  const templates = useTemplates();
  const recent = useRecentForPicks();
  const picks = quickPicks(templates.data ?? [], recent.data?.items ?? [], categories.data ?? []);

  /** The budget's "today" is in the user's time zone; the device zone is only a fallback. */
  function today() {
    return (
      budget.data?.asOf ??
      todayInTimeZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)
    );
  }

  function save(category: Category) {
    const parsed = parseMoneyInput(amount);
    if (!parsed.ok) {
      setError(t.amountErrors[parsed.reason]);
      return;
    }
    void saveExpense({ amount: parsed.grosze, date: today(), category });
    router.back();
  }

  function saveAgain(pick: QuickPick) {
    void saveExpense({
      amount: grosze(pick.amount),
      date: today(),
      category: pick.category,
      note: pick.note,
    });
    router.back();
  }

  let grid: ReactNode;
  if (categories.isPending) {
    grid = <Skeleton label={t.loadingCategories} lines={3} />;
  } else if (categories.isError) {
    grid = <LoadError message={t.categoriesError} onRetry={() => void categories.refetch()} />;
  } else {
    grid = (
      <View className="flex-row flex-wrap gap-[3.5%] gap-y-3">
        {categories.data.map((category) => (
          <CategoryTile
            key={category.id}
            category={category}
            onPress={() => {
              save(category);
            }}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen title={t.title}>
      <TextField
        label={t.amount}
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          setError(undefined);
        }}
        error={error}
        autoFocus
        keyboardType="decimal-pad"
      />
      {picks.length > 0 && (
        <View className="gap-3">
          <View className="gap-0.5">
            <Text accessibilityRole="header" className="font-sans-semibold text-sm text-foreground">
              {t.quick}
            </Text>
            <Text className="font-sans text-sm text-muted-foreground">{t.quickHint}</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {picks.map((pick) => (
              <QuickPickChip
                key={pick.key}
                pick={pick}
                onPress={() => {
                  saveAgain(pick);
                }}
              />
            ))}
          </View>
        </View>
      )}
      <View className="gap-3">
        <Text className="font-sans text-sm text-muted-foreground">{t.categoriesHint}</Text>
        {grid}
      </View>
      <Button
        variant="ghost"
        onPress={() => {
          router.back();
        }}
      >
        {t.cancel}
      </Button>
    </Screen>
  );
}
