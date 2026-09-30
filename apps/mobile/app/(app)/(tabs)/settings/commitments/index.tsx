import { formatMoney, grosze, type RecurringRule } from "@vireo/shared";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "../../../../../src/components/button";
import { LoadError, Skeleton } from "../../../../../src/components/query-states";
import { Screen } from "../../../../../src/components/screen";
import { useCategories } from "../../../../../src/dashboard/queries";
import { pl } from "../../../../../src/messages/pl";
import { useRecurringRules } from "../../../../../src/settings/queries";
import { scheduleSummary } from "../../../../../src/settings/schedule";
import { BackButton, ListRow } from "../../../../../src/settings/settings-screen-parts";

const t = pl.budgetSettings;

/** "1500 zł · co miesiąc, 5. dnia" — a cost rounds up, never promising more money. */
function describe(rule: RecurringRule): string {
  return t.summary.row(
    formatMoney(grosze(rule.expectedAmount ?? 0), { whole: "up" }),
    scheduleSummary(rule),
  );
}

/**
 * Active expense rules. Income rules are schedules of income sources and
 * live on the income screen; switched-off rules are not commitments.
 */
export default function CommitmentList() {
  const rules = useRecurringRules();
  const categories = useCategories();
  const categoryName = (id: string | null) =>
    categories.data?.find((category) => category.id === id)?.name;

  let list: ReactNode;
  if (rules.isPending) {
    list = <Skeleton label={t.commitments.loading} lines={3} />;
  } else if (rules.isError) {
    list = <LoadError message={t.commitments.error} onRetry={() => void rules.refetch()} />;
  } else {
    const commitments = rules.data.filter((rule) => rule.kind === "EXPENSE" && rule.isActive);
    list =
      commitments.length === 0 ? (
        <Text className="font-sans text-base text-muted-foreground">{t.commitments.empty}</Text>
      ) : (
        <View className="gap-2">
          {commitments.map((rule) => {
            const category = categoryName(rule.categoryId);
            return (
              <ListRow
                key={rule.id}
                // Required for expense rules by the API; `??` only satisfies the type.
                name={rule.name ?? ""}
                details={category ? [describe(rule), category] : [describe(rule)]}
                onPress={() => {
                  router.push(`/settings/commitments/${rule.id}`);
                }}
              />
            );
          })}
        </View>
      );
  }

  return (
    <Screen title={t.commitments.title}>
      {list}
      <Button
        variant="outline"
        onPress={() => {
          router.push("/settings/commitments/new");
        }}
      >
        {t.commitments.add}
      </Button>
      <BackButton />
    </Screen>
  );
}
