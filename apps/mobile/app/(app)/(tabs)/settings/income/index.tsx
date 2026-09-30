import { formatMoney, grosze, type IncomeSource } from "@vireo/shared";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "../../../../../src/components/button";
import { LoadError, Skeleton } from "../../../../../src/components/query-states";
import { Screen } from "../../../../../src/components/screen";
import { pl } from "../../../../../src/messages/pl";
import { useIncomeSources } from "../../../../../src/settings/queries";
import { scheduleSummary } from "../../../../../src/settings/schedule";
import { BackButton, ListRow } from "../../../../../src/settings/settings-screen-parts";

const t = pl.budgetSettings;

/** "5000 zł · co miesiąc, 10. dnia", or "Nieregularny". */
function describe(source: IncomeSource): string {
  if (source.kind === "IRREGULAR" || source.expectedAmount === null) return t.summary.irregular;
  // Income rounds down: the list must not promise more than comes in.
  const amount = formatMoney(grosze(source.expectedAmount), { whole: "down" });
  return t.summary.row(
    amount,
    source.schedule ? scheduleSummary(source.schedule) : t.summary.oncePerPeriod,
  );
}

/** Incomes the budget counts. Archived ones keep their history but are not listed. */
export default function IncomeList() {
  const sources = useIncomeSources();

  let list: ReactNode;
  if (sources.isPending) {
    list = <Skeleton label={t.income.loading} lines={3} />;
  } else if (sources.isError) {
    list = <LoadError message={t.income.error} onRetry={() => void sources.refetch()} />;
  } else {
    const active = sources.data.filter((source) => source.isActive);
    list =
      active.length === 0 ? (
        <Text className="font-sans text-base text-muted-foreground">{t.income.empty}</Text>
      ) : (
        <View className="gap-2">
          {active.map((source) => (
            <ListRow
              key={source.id}
              name={source.name}
              details={[describe(source)]}
              onPress={() => {
                router.push(`/settings/income/${source.id}`);
              }}
            />
          ))}
        </View>
      );
  }

  return (
    <Screen title={t.income.title}>
      {list}
      <Button
        variant="outline"
        onPress={() => {
          router.push("/settings/income/new");
        }}
      >
        {t.income.add}
      </Button>
      <BackButton />
    </Screen>
  );
}
