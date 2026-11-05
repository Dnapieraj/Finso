import { useMutation } from "@tanstack/react-query";
import { grosze } from "@vireo/shared";
import { Text, View } from "react-native";

import { api } from "../api";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { FormAlert } from "../components/form-alert";
import { useCategories } from "../dashboard/queries";
import { haptics } from "../feedback/haptics";
import { pl } from "../messages/pl";
import { useMoney } from "../privacy/money";
import { queryClient } from "../query-client";
import { LIMITS_KEY, useCategoryLimits } from "./queries";

const t = pl.limits.lean;

/**
 * „Chudy miesiąc” for irregular income: the budget counts clearly less than
 * usually comes in, said in so many words, with where to cut and one tap to
 * make a hint a limit. Only in such a period; loading and errors show nothing.
 */
export function LeanMonthCard() {
  const limits = useCategoryLimits();
  const categories = useCategories();
  const money = useMoney();
  const setLimit = useMutation({
    mutationFn: (input: { categoryId: string; amount: number }) =>
      api.categoryLimits.set(input.categoryId, { amount: input.amount }),
    onSuccess: () => {
      haptics.saved();
      return queryClient.invalidateQueries({ queryKey: LIMITS_KEY });
    },
    onError: haptics.failed,
  });

  const lean = limits.data?.leanMonth;
  if (!lean) return null;

  // Both sides rounded down: what is counted is no promise of more.
  const down = (amount: number) => money.format(grosze(amount), { whole: "down" });
  const nameOf = (id: string) =>
    categories.data?.find((category) => category.id === id)?.name ?? pl.history.noCategory;

  return (
    <Card title={t.title}>
      <Text
        accessibilityLabel={money.spoken(t.body(down(lean.counted), down(lean.typical)))}
        className="font-sans text-base text-card-foreground"
      >
        {t.body(down(lean.counted), down(lean.typical))}
      </Text>
      {setLimit.isError && <FormAlert tone="error">{t.setError}</FormAlert>}
      {lean.suggestions.length === 0 ? (
        <Text className="font-sans text-sm text-muted-foreground">{t.noHints}</Text>
      ) : (
        <View className="gap-3">
          <Text className="font-sans-semibold text-sm text-muted-foreground">{t.cut}</Text>
          {lean.suggestions.map((suggestion) => {
            const name = nameOf(suggestion.categoryId);
            const line = t.suggestion(name, down(suggestion.usual), down(suggestion.suggested));
            return (
              <View key={suggestion.categoryId} className="gap-1">
                <Text
                  accessibilityLabel={money.spoken(line)}
                  className="font-sans text-base text-card-foreground"
                >
                  {line}
                </Text>
                <Button
                  variant="outline"
                  accessibilityLabel={money.spoken(t.setLabel(down(suggestion.suggested), name))}
                  loading={
                    setLimit.isPending && setLimit.variables.categoryId === suggestion.categoryId
                  }
                  loadingLabel={pl.budgetSettings.saving}
                  onPress={() => {
                    setLimit.mutate({
                      categoryId: suggestion.categoryId,
                      amount: suggestion.suggested,
                    });
                  }}
                >
                  {t.set}
                </Button>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}
