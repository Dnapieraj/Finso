import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { LoadError, Skeleton } from "../../../../../src/components/query-states";
import { Screen } from "../../../../../src/components/screen";
import { pl } from "../../../../../src/messages/pl";
import { CommitmentForm } from "../../../../../src/settings/commitment-form";
import { useRecurringRules } from "../../../../../src/settings/queries";
import { BackButton } from "../../../../../src/settings/settings-screen-parts";

const t = pl.budgetSettings;

/** Editing one commitment, found in the list the previous screen already loaded. */
export default function EditCommitment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rules = useRecurringRules();
  const rule = rules.data?.find((item) => item.id === id && item.kind === "EXPENSE");

  if (rule) return <CommitmentForm rule={rule} />;
  return (
    <Screen title={t.commitments.editTitle}>
      {rules.isPending ? (
        <Skeleton label={t.commitments.loading} lines={3} />
      ) : rules.isError ? (
        <LoadError message={t.commitments.error} onRetry={() => void rules.refetch()} />
      ) : (
        <Text className="font-sans text-base text-foreground">{t.commitments.notFound}</Text>
      )}
      <BackButton />
    </Screen>
  );
}
