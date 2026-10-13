import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { LoadError, Skeleton } from "../../../../../src/components/query-states";
import { Screen } from "../../../../../src/components/screen";
import { pl } from "../../../../../src/messages/pl";
import { BackButton } from "../../../../../src/settings/settings-screen-parts";
import { TemplateForm } from "../../../../../src/settings/template-form";
import { useTemplates } from "../../../../../src/templates/queries";

const t = pl.budgetSettings;

/** Editing one template, found in the list the previous screen already loaded. */
export default function EditTemplate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const templates = useTemplates();
  const template = templates.data?.find((item) => item.id === id);

  if (template) return <TemplateForm template={template} />;
  return (
    <Screen title={t.templates.editTitle}>
      {templates.isPending ? (
        <Skeleton label={t.templates.loading} lines={3} />
      ) : templates.isError ? (
        <LoadError message={t.templates.error} onRetry={() => void templates.refetch()} />
      ) : (
        <Text className="font-sans text-base text-foreground">{t.templates.notFound}</Text>
      )}
      <BackButton />
    </Screen>
  );
}
