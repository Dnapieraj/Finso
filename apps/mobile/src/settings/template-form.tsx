import { router } from "expo-router";
import { useState } from "react";

import {
  parseMoneyInput,
  type CreateExpenseTemplateInput,
  type ExpenseTemplate,
  type UpdateExpenseTemplateInput,
} from "@vireo/shared";

import { api } from "../api";
import { apiErrorMessage } from "../auth/api-error-message";
import { Button } from "../components/button";
import { FormAlert } from "../components/form-alert";
import { Screen } from "../components/screen";
import { TextField } from "../components/text-field";
import { haptics } from "../feedback/haptics";
import { pl } from "../messages/pl";
import { amountError } from "../onboarding/draft";
import { TEMPLATES_KEY } from "../templates/queries";
import { CategoryPicker } from "./category-picker";
import { toMoneyInput, useSettingsMutation, validateName } from "./forms";
import { BackButton, DeleteWithConfirmation } from "./settings-screen-parts";

const t = pl.budgetSettings;

/** Matches the API: a short name that fits on a quick add button. */
const NAME_MAX = 40;

type Save =
  | { action: "create"; input: CreateExpenseTemplateInput }
  | { action: "update"; id: string; change: UpdateExpenseTemplateInput };

interface Errors {
  name?: string;
  amount?: string;
  category?: string;
}

/**
 * Adding (no `template`) or editing a quick add template: name, amount and
 * category. Only what changed is sent. No Idempotency-Key: a template saved
 * twice shows on the list and goes with one tap.
 */
export function TemplateForm({ template }: { template?: ExpenseTemplate }) {
  const [name, setName] = useState(template?.name ?? "");
  const [amount, setAmount] = useState(template ? toMoneyInput(template.amount) : "");
  const [categoryId, setCategoryId] = useState(template?.categoryId ?? null);
  const [errors, setErrors] = useState<Errors>({});

  const save = useSettingsMutation(TEMPLATES_KEY, (request: Save) =>
    request.action === "create"
      ? api.expenseTemplates.create(request.input)
      : api.expenseTemplates.update(request.id, request.change),
  );
  const remove = useSettingsMutation(TEMPLATES_KEY, (id: string) =>
    api.expenseTemplates.remove(id),
  );

  function submit() {
    const found: Errors = {};
    const parsedName = validateName(name);
    if (!parsedName.ok) found.name = parsedName.message;
    else if (parsedName.name.length > NAME_MAX) found.name = t.templates.nameTooLong;
    const parsedAmount = parseMoneyInput(amount);
    if (!parsedAmount.ok) found.amount = amountError(parsedAmount.reason);
    if (categoryId === null) found.category = t.templates.categoryRequired;

    setErrors(found);
    if (
      !parsedName.ok ||
      !parsedAmount.ok ||
      categoryId === null ||
      Object.keys(found).length > 0
    ) {
      haptics.failed();
      return;
    }

    if (!template) {
      save.mutate({
        action: "create",
        input: { name: parsedName.name, amount: parsedAmount.grosze, categoryId },
      });
      return;
    }

    const change: UpdateExpenseTemplateInput = {};
    if (parsedName.name !== template.name) change.name = parsedName.name;
    if (parsedAmount.grosze !== template.amount) change.amount = parsedAmount.grosze;
    if (categoryId !== template.categoryId) change.categoryId = categoryId;
    if (Object.keys(change).length === 0) router.back();
    else save.mutate({ action: "update", id: template.id, change });
  }

  const failure = save.error ?? remove.error;
  return (
    <Screen title={template ? t.templates.editTitle : t.templates.newTitle}>
      {failure && <FormAlert tone="error">{apiErrorMessage(failure, "settings")}</FormAlert>}
      <TextField
        label={t.name}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setErrors((current) => ({ ...current, name: undefined }));
        }}
        error={errors.name}
      />
      <TextField
        label={t.amount}
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          setErrors((current) => ({ ...current, amount: undefined }));
        }}
        error={errors.amount}
        keyboardType="decimal-pad"
      />
      <CategoryPicker
        value={categoryId}
        error={errors.category}
        onChange={(id) => {
          setCategoryId(id);
          setErrors((current) => ({ ...current, category: undefined }));
        }}
      />
      <Button loading={save.isPending} loadingLabel={t.saving} onPress={submit}>
        {t.save}
      </Button>
      {template && (
        <DeleteWithConfirmation
          label={t.templates.delete}
          warning={t.templates.deleteWarning}
          pending={remove.isPending}
          onConfirm={() => {
            remove.mutate(template.id);
          }}
        />
      )}
      <BackButton />
    </Screen>
  );
}
