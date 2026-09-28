import { parseMoneyInput, todayInTimeZone, type Category } from "@vireo/shared";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Button } from "../../src/components/button";
import { LoadError, Skeleton } from "../../src/components/query-states";
import { Screen } from "../../src/components/screen";
import { TextField } from "../../src/components/text-field";
import { useBudget, useCategories } from "../../src/dashboard/queries";
import { CategoryIcon } from "../../src/expenses/category-icon";
import { saveExpense } from "../../src/expenses/save-expense";
import { pl } from "../../src/messages/pl";

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

/**
 * Quick add in three interactions: "+" on the dashboard, the amount (the
 * field is focused on open), a category tap — which saves and closes.
 * The save runs on after the screen closes (src/expenses/save-expense).
 */
export default function AddExpenseScreen() {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | undefined>();
  const categories = useCategories();
  const budget = useBudget();

  function save(category: Category) {
    const parsed = parseMoneyInput(amount);
    if (!parsed.ok) {
      setError(t.amountErrors[parsed.reason]);
      return;
    }
    // The budget's "today" is computed in the user's time zone; the device
    // zone is only a fallback if the budget has not loaded.
    const date =
      budget.data?.asOf ??
      todayInTimeZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    void saveExpense({ amount: parsed.grosze, date, category });
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
