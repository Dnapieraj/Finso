import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";

import type { Grosze } from "@vireo/shared";

import { pl } from "../messages/pl";
import { queryClient } from "../query-client";
import { refreshBudget } from "./queries";

const t = pl.budgetSettings;

/** Longest name the API accepts for an income source or a rule. */
const NAME_MAX = 100;

/** A required name, trimmed; or why it cannot be saved. */
export function validateName(
  text: string,
): { ok: true; name: string } | { ok: false; message: string } {
  const name = text.trim();
  if (name === "") return { ok: false, message: t.nameRequired };
  if (name.length > NAME_MAX) return { ok: false, message: t.nameTooLong };
  return { ok: true, name };
}

/** Grosze as typed into a money field: "5000", "5200,50". */
export function toMoneyInput(amount: Grosze | number): string {
  const zloty = Math.floor(amount / 100);
  const grosze = amount % 100;
  return grosze === 0 ? String(zloty) : `${String(zloty)},${String(grosze).padStart(2, "0")}`;
}

/**
 * A save or delete on a settings form: afterwards the list it came from
 * and the budget ask the API again, and the form closes.
 */
export function useSettingsMutation<Input, Result>(
  listKey: readonly unknown[],
  mutationFn: (input: Input) => Promise<Result>,
) {
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
      void refreshBudget();
      router.back();
    },
  });
}
