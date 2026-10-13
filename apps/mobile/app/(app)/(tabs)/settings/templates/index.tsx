import { grosze } from "@vireo/shared";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "../../../../../src/components/button";
import { LoadError, Skeleton } from "../../../../../src/components/query-states";
import { Screen } from "../../../../../src/components/screen";
import { useCategories } from "../../../../../src/dashboard/queries";
import { pl } from "../../../../../src/messages/pl";
import { useMoney } from "../../../../../src/privacy/money";
import { BackButton, ListRow } from "../../../../../src/settings/settings-screen-parts";
import { useTemplates } from "../../../../../src/templates/queries";

const t = pl.budgetSettings;

/** Quick add templates: what each one saves, in the order they were added. */
export default function TemplateList() {
  const templates = useTemplates();
  const categories = useCategories();
  const money = useMoney();
  const categoryName = (id: string | null) =>
    categories.data?.find((category) => category.id === id)?.name;

  let list: ReactNode;
  if (templates.isPending) {
    list = <Skeleton label={t.templates.loading} lines={3} />;
  } else if (templates.isError) {
    list = <LoadError message={t.templates.error} onRetry={() => void templates.refetch()} />;
  } else if (templates.data.length === 0) {
    list = <Text className="font-sans text-base text-muted-foreground">{t.templates.empty}</Text>;
  } else {
    list = (
      <View className="gap-2">
        {templates.data.map((template) => (
          <ListRow
            key={template.id}
            name={template.name}
            details={[
              t.templates.row(
                // Exact grosze: the template saves exactly this.
                money.format(grosze(template.amount)),
                categoryName(template.categoryId) ?? t.templates.noCategory,
              ),
            ]}
            onPress={() => {
              router.push(`/settings/templates/${template.id}`);
            }}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen title={t.templates.title}>
      {list}
      <Button
        variant="outline"
        onPress={() => {
          router.push("/settings/templates/new");
        }}
      >
        {t.templates.add}
      </Button>
      <BackButton />
    </Screen>
  );
}
