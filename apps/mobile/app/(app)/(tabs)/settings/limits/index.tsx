import { router } from "expo-router";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "../../../../../src/components/button";
import { LoadError, Skeleton } from "../../../../../src/components/query-states";
import { Screen } from "../../../../../src/components/screen";
import { useCategories } from "../../../../../src/dashboard/queries";
import { limitLine } from "../../../../../src/limits/limit-line";
import { useCategoryLimits } from "../../../../../src/limits/queries";
import { pl } from "../../../../../src/messages/pl";
import { useMoney } from "../../../../../src/privacy/money";
import { ListRow } from "../../../../../src/settings/settings-screen-parts";

const t = pl.limits;

/** Category limits: what is left of each this period, in the order they were set. */
export default function LimitList() {
  const limits = useCategoryLimits();
  const categories = useCategories();
  const money = useMoney();
  const categoryName = (id: string) =>
    categories.data?.find((category) => category.id === id)?.name ??
    pl.budgetSettings.templates.noCategory;

  let list: ReactNode;
  if (limits.isPending) {
    list = <Skeleton label={t.loading} lines={3} />;
  } else if (limits.isError) {
    list = <LoadError message={t.error} onRetry={() => void limits.refetch()} />;
  } else if (limits.data.limits.length === 0) {
    list = <Text className="font-sans text-base text-muted-foreground">{t.empty}</Text>;
  } else {
    list = (
      <View className="gap-2">
        {limits.data.limits.map((status) => (
          <ListRow
            key={status.categoryId}
            name={categoryName(status.categoryId)}
            details={[limitLine(money, status)]}
            onPress={() => {
              router.push(`/settings/limits/${status.categoryId}`);
            }}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen back title={t.title}>
      {list}
      <Button
        variant="outline"
        onPress={() => {
          router.push("/settings/limits/new");
        }}
      >
        {t.add}
      </Button>
    </Screen>
  );
}
