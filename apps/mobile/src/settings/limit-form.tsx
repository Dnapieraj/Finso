import { parseMoneyInput } from "@vireo/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { api } from "../api";
import { apiErrorMessage } from "../auth/api-error-message";
import { Button } from "../components/button";
import { FormAlert } from "../components/form-alert";
import { Screen } from "../components/screen";
import { TextField } from "../components/text-field";
import { useCategories } from "../dashboard/queries";
import { haptics } from "../feedback/haptics";
import { LIMITS_KEY } from "../limits/queries";
import { pl } from "../messages/pl";
import { amountError } from "../onboarding/draft";
import { CategoryPicker } from "./category-picker";
import { toMoneyInput, useSettingsMutation } from "./forms";
import { DeleteWithConfirmation } from "./settings-screen-parts";

const t = pl.limits;
const s = pl.budgetSettings;

interface Errors {
  category?: string;
  amount?: string;
}

/**
 * A new limit (no `limit`: pick a category without one) or a change of an
 * existing one (the category is fixed — one limit per category). Saving is
 * a PUT: sending it twice gives the same limit, so no Idempotency-Key.
 */
export function LimitForm({
  limit,
  taken = [],
}: {
  limit?: { categoryId: string; amount: number };
  /** Categories that already have a limit — not offered for a new one. */
  taken?: readonly string[];
}) {
  const categories = useCategories();
  const [categoryId, setCategoryId] = useState(limit?.categoryId ?? null);
  const [amount, setAmount] = useState(limit ? toMoneyInput(limit.amount) : "");
  const [errors, setErrors] = useState<Errors>({});

  const save = useSettingsMutation(LIMITS_KEY, (request: { categoryId: string; amount: number }) =>
    api.categoryLimits.set(request.categoryId, { amount: request.amount }),
  );
  const remove = useSettingsMutation(LIMITS_KEY, (id: string) => api.categoryLimits.remove(id));

  function submit() {
    const found: Errors = {};
    if (categoryId === null) found.category = t.categoryRequired;
    const parsed = parseMoneyInput(amount);
    if (!parsed.ok) found.amount = amountError(parsed.reason);
    setErrors(found);
    if (categoryId === null || !parsed.ok) {
      haptics.failed();
      return;
    }
    if (parsed.grosze === limit?.amount) router.back();
    else save.mutate({ categoryId, amount: parsed.grosze });
  }

  const name = categories.data?.find((category) => category.id === limit?.categoryId)?.name;
  const allTaken =
    !limit && categories.data?.every((category) => taken.includes(category.id)) === true;
  const failure = save.error ?? remove.error;
  return (
    <Screen back title={limit ? t.editTitle(name ?? s.templates.noCategory) : t.newTitle}>
      {failure && <FormAlert tone="error">{apiErrorMessage(failure, "settings")}</FormAlert>}
      {!limit &&
        (allTaken ? (
          <Text className="font-sans text-base text-muted-foreground">{t.allLimited}</Text>
        ) : (
          <CategoryPicker
            value={categoryId}
            exclude={taken}
            error={errors.category}
            onChange={(id) => {
              setCategoryId(id);
              setErrors((current) => ({ ...current, category: undefined }));
            }}
          />
        ))}
      <TextField
        label={t.amount}
        hint={t.amountHint}
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          setErrors((current) => ({ ...current, amount: undefined }));
        }}
        error={errors.amount}
        keyboardType="decimal-pad"
      />
      <Button loading={save.isPending} loadingLabel={s.saving} onPress={submit}>
        {s.save}
      </Button>
      {limit && (
        <DeleteWithConfirmation
          label={t.delete}
          warning={t.deleteWarning}
          pending={remove.isPending}
          onConfirm={() => {
            remove.mutate(limit.categoryId);
          }}
        />
      )}
    </Screen>
  );
}
