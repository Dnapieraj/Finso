import { useMutation } from "@tanstack/react-query";

import type { CompleteOnboardingRequest, PublicUser } from "@vireo/shared";
import { ApiError } from "@vireo/shared/api";

import { api } from "../api";
import { ME_KEY } from "../auth/hooks";
import { queryClient } from "../query-client";

/**
 * Saves all answers at once. The returned user has `onboardingCompleted`,
 * and putting it in the cache is what switches the guards to the app.
 *
 * 409 means the answers are already saved — on another phone, or by an
 * attempt whose response was lost. The account is set up, so this is a
 * success: the current account comes from the API instead.
 */
export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: async (input: CompleteOnboardingRequest): Promise<PublicUser> => {
      try {
        return await api.users.completeOnboarding(input);
      } catch (error) {
        if (error instanceof ApiError && error.kind === "http" && error.status === 409) {
          return api.users.me();
        }
        throw error;
      }
    },
    onSuccess: (user) => {
      queryClient.setQueryData(ME_KEY, user);
      // Nothing budget-related should survive from before the new settings.
      void queryClient.invalidateQueries({ queryKey: ["budget"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
