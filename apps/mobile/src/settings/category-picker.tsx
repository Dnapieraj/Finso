import { type ReactNode } from "react";
import { Text, View } from "react-native";

import { LoadError, Skeleton } from "../components/query-states";
import { useCategories } from "../dashboard/queries";
import { CategoryChip } from "../expenses/category-chip";
import { pl } from "../messages/pl";
import { FieldError } from "../onboarding/step";

const t = pl.budgetSettings;

/** One category out of the system ones and the user's own, as radio chips. */
export function CategoryPicker({
  value,
  error,
  onChange,
}: {
  value: string | null;
  error?: string;
  onChange: (categoryId: string) => void;
}) {
  const categories = useCategories();

  let list: ReactNode;
  if (categories.isPending) {
    list = <Skeleton label={t.commitments.loadingCategories} />;
  } else if (categories.isError) {
    list = (
      <LoadError
        message={t.commitments.categoriesError}
        onRetry={() => void categories.refetch()}
      />
    );
  } else {
    list = (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t.commitments.category}
        className="flex-row flex-wrap gap-2"
      >
        {categories.data.map((category) => (
          <CategoryChip
            key={category.id}
            category={category}
            selected={category.id === value}
            onPress={() => {
              onChange(category.id);
            }}
          />
        ))}
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Text className="font-sans-semibold text-sm text-foreground">{t.commitments.category}</Text>
      {list}
      <FieldError>{error}</FieldError>
    </View>
  );
}
