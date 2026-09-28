import { useMutation, useQuery } from "@tanstack/react-query";

import type { DeleteAccountInput, LoginInput, RegisterInput } from "@vireo/shared";

import { api } from "../api";
import { session } from "../session";

/** Logs in; the guards open the app once the session switches to signed-in. */
export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onSuccess: () => {
      session.signedIn();
    },
  });
}

/** Creates the account and signs straight in, as the API returns a session. */
export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => api.auth.register(input),
    onSuccess: () => {
      session.signedIn();
    },
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

/** The signed-in user's account. */
export function useMe() {
  return useQuery({ queryKey: ["users", "me"], queryFn: () => api.users.me() });
}
