import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { LoadError, Skeleton } from "../../../../../src/components/query-states";
import { Screen } from "../../../../../src/components/screen";
import { useCategoryLimits } from "../../../../../src/limits/queries";
import { pl } from "../../../../../src/messages/pl";
import { LimitForm } from "../../../../../src/settings/limit-form";

const t = pl.limits;

/** Changing one limit, found in the overview the previous screen already loaded. */
export default function EditLimit() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const limits = useCategoryLimits();
  const status = limits.data?.limits.find((limit) => limit.categoryId === categoryId);

  if (status) return <LimitForm limit={{ categoryId, amount: status.limit }} />;
  return (
    <Screen back title={t.title}>
      {limits.isPending ? (
        <Skeleton label={t.loading} lines={3} />
      ) : limits.isError ? (
        <LoadError message={t.error} onRetry={() => void limits.refetch()} />
      ) : (
        <Text className="font-sans text-base text-foreground">{t.notFound}</Text>
      )}
    </Screen>
  );
}
