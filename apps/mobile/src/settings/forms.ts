import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef } from "react";

import type { Grosze, IdempotentDraft } from "@vireo/shared";

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

/**
 * One Idempotency-Key per thing being created: "Zapisz" again after a
 * failure resends the same draft, so a save that did reach the server is
 * not made twice. Once the form says something else, it is a new thing
 * with a new key.
 */
export function useDraft<T>(
  makeDraft: (input: T) => IdempotentDraft<T>,
): (input: T) => IdempotentDraft<T> {
  const last = useRef<IdempotentDraft<T> | null>(null);
  return (input) => {
    // Plain JSON data from the form, so equal text means equal input.
    if (last.current && JSON.stringify(last.current.input) === JSON.stringify(input)) {
      return last.current;
    }
    last.current = makeDraft(input);
    return last.current;
  };
}
