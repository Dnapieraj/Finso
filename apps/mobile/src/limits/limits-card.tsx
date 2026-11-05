import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Card } from "../components/card";
import { ProgressBar } from "../components/progress-bar";
import { useCategories } from "../dashboard/queries";
import { pl } from "../messages/pl";
import { useMoney } from "../privacy/money";
import { limitLine } from "./limit-line";
import { useCategoryLimits } from "./queries";

const t = pl.limits;

/**
 * What is left of each category limit this period. Only with limits set;
 * loading and errors show nothing — „Możesz wydać” does not depend on it,
 * and Settings → Limity kategorii has the full states.
 */
export function LimitsCard() {
  const limits = useCategoryLimits();
  const categories = useCategories();
  const money = useMoney();
  const statuses = limits.data?.limits ?? [];
  if (statuses.length === 0) return null;

  return (
    <Card title={t.card}>
      {statuses.map((status) => {
        const name =
          categories.data?.find((category) => category.id === status.categoryId)?.name ??
          pl.history.noCategory;
        const line = limitLine(money, status);
        return (
          <Pressable
            key={status.categoryId}
            accessibilityRole="button"
            accessibilityLabel={`${t.rowLabel(name)}, ${money.spoken(line)}`}
            onPress={() => {
              router.push(`/settings/limits/${status.categoryId}`);
            }}
            className="gap-1.5 active:opacity-70"
          >
            <Text className="font-sans-semibold text-base text-card-foreground">{name}</Text>
            <Text
              className={
                status.state === "ok"
                  ? "font-sans text-sm text-muted-foreground"
                  : "font-sans-semibold text-sm text-caution"
              }
            >
              {line}
            </Text>
            {/* The bar only illustrates: the line above says the same in words. */}
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <ProgressBar label={name} now={status.spent} max={status.limit} valueText={line} />
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}
