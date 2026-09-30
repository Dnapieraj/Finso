import { useMutation, useQuery } from "@tanstack/react-query";

import type { DeleteAccountInput, LoginInput, PublicUser, RegisterInput } from "@vireo/shared";

import { api } from "../api";
import { queryClient } from "../query-client";
import { session } from "../session";

/** Cache key of the signed-in account. */
export const ME_KEY = ["users", "me"] as const;

/**
 * The login and register responses already carry the account; caching it
 * lets the guards decide between onboarding and the app without asking
 * the API again (and without a loading screen in between).
 */
function signedIn(user: PublicUser) {
  queryClient.setQueryData(ME_KEY, user);
  session.signedIn();
}

/** Logs in; the guards open the app once the session switches to signed-in. */
export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onSuccess: signedIn,
  });
}

/** Creates the account and signs straight in, as the API returns a session. */
export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => api.auth.register(input),
    onSuccess: signedIn,
  });
}

/** Logs out; ends the local session even when the server call fails. */
export function useLogout() {
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => session.signedOut("logout"),
  });
}

/** Deletes the account after password confirmation (`DELETE /users/me`). */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (input: DeleteAccountInput) => api.users.deleteMe(input),
    onSuccess: () => session.signedOut("deleted"),
  });
}

/**
 * The signed-in user's account, loaded once per launch by the app's
 * layout. Never stale on its own: it changes only through this app
 * (onboarding, settings), which updates the cache itself.
 */
export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: () => api.users.me(), staleTime: Infinity });
}
