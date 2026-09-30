import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { LoadError, Skeleton } from "../../../../../src/components/query-states";
import { Screen } from "../../../../../src/components/screen";
import { pl } from "../../../../../src/messages/pl";
import { IncomeForm } from "../../../../../src/settings/income-form";
import { useIncomeSources } from "../../../../../src/settings/queries";
import { BackButton } from "../../../../../src/settings/settings-screen-parts";

const t = pl.budgetSettings;

/** Editing one income, found in the list the previous screen already loaded. */
export default function EditIncome() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sources = useIncomeSources();
  const source = sources.data?.find((item) => item.id === id);

  if (source) return <IncomeForm source={source} />;
  return (
    <Screen title={t.income.editTitle}>
      {sources.isPending ? (
        <Skeleton label={t.income.loading} lines={3} />
      ) : sources.isError ? (
        <LoadError message={t.income.error} onRetry={() => void sources.refetch()} />
      ) : (
        <Text className="font-sans text-base text-foreground">{t.income.notFound}</Text>
      )}
      <BackButton />
    </Screen>
  );
}
