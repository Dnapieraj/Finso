import { grosze, type BudgetSummary, type IncomeSource } from "@vireo/shared";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "../../../../../src/components/button";
import { LoadError, Skeleton } from "../../../../../src/components/query-states";
import { Screen } from "../../../../../src/components/screen";
import { useBudget } from "../../../../../src/dashboard/queries";
import { pl } from "../../../../../src/messages/pl";
import { useMoney, type Money } from "../../../../../src/privacy/money";
import { useIncomeSources } from "../../../../../src/settings/queries";
import { scheduleSummary } from "../../../../../src/settings/schedule";
import { ListRow } from "../../../../../src/settings/settings-screen-parts";

const t = pl.budgetSettings;

type Forecast = BudgetSummary["incomeForecasts"][number];

/**
 * An irregular income: the forecast the budget counts, with the usual range;
 * without enough history, that only what came in counts. Income rounds down,
 * the top of the range up.
 */
function describeIrregular(forecast: Forecast | undefined, money: Money): string[] {
  if (!forecast) return [t.summary.irregular, t.summary.noForecastYet];
  const low = money.format(grosze(forecast.low), { whole: "down" }).replace(/\u00A0zł$/, "");
  return [
    t.summary.irregular,
    t.summary.forecast(
      money.format(grosze(forecast.forecast), { whole: "down" }),
      low,
      money.format(grosze(forecast.high), { whole: "up" }),
    ),
  ];
}

/** "5000 zł · co miesiąc, 10. dnia". */
function describe(source: IncomeSource, money: Money): string {
  if (source.expectedAmount === null) return t.summary.irregular;
  // Income rounds down: the list must not promise more than comes in.
  const amount = money.format(grosze(source.expectedAmount), { whole: "down" });
  return t.summary.row(
    amount,
    source.schedule ? scheduleSummary(source.schedule) : t.summary.oncePerPeriod,
  );
}

/** Incomes the budget counts. Archived ones keep their history but are not listed. */
export default function IncomeList() {
  const sources = useIncomeSources();
  const budget = useBudget();
  const money = useMoney();
  const forecastOf = (id: string) =>
    budget.data?.incomeForecasts.find((line) => line.incomeSourceId === id);

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
              details={
                source.kind === "IRREGULAR" || source.expectedAmount === null
                  ? describeIrregular(forecastOf(source.id), money)
                  : [describe(source, money)]
              }
              onPress={() => {
                router.push(`/settings/income/${source.id}`);
              }}
            />
          ))}
        </View>
      );
  }

  return (
    <Screen back title={t.income.title}>
      {list}
      <Button
        variant="outline"
        onPress={() => {
          router.push("/settings/income/new");
        }}
      >
        {t.income.add}
      </Button>
    </Screen>
  );
}
