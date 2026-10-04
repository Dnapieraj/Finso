import type { AnswerConfirmationRequest } from "@vireo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { queryClient } from "../query-client";
import { refreshBudget } from "../settings/queries";

export const CONFIRMATIONS_KEY = ["confirmations"] as const;

/** Income and fixed payments waiting for an answer, current and overdue. */
export function useConfirmations() {
  return useQuery({ queryKey: CONFIRMATIONS_KEY, queryFn: () => api.confirmations.list() });
}

/**
 * One answer. Afterwards the list asks the API again (the item closes, or
 * stops asking after „Jeszcze nie”) and so does the budget, because a
 * confirmed amount or „Nie w tym okresie” changes „Możesz wydać”.
 */
export function useAnswerConfirmation() {
  return useMutation({
    mutationFn: (input: AnswerConfirmationRequest) => api.confirmations.answer(input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: CONFIRMATIONS_KEY }),
        refreshBudget(),
      ]),
  });
}
