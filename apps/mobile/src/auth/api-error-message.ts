import { ApiError } from "@vireo/shared/api";

import { pl } from "../messages/pl";

const t = pl.apiErrors;

/** The screen that sent the request; the same status means different things per screen. */
export type AuthAction =
  | "login"
  | "register"
  | "delete-account"
  | "onboarding"
  | "settings"
  | "email-code"
  | "change-password";

/**
 * A message for the user from a failed request. Never the API's own
 * `message`: it is English, technical, and may change without notice.
 */
export function apiErrorMessage(error: unknown, action: AuthAction): string {
  if (!(error instanceof ApiError)) return t.generic;
  if (error.kind === "network") return t.network;
  if (error.kind !== "http") return t.generic;

  switch (error.status) {
    case 401:
      // Only login answers 401 for bad credentials; anywhere else it means
      // the refresh failed too, so the session is gone.
      return action === "login" ? t.invalidCredentials : t.sessionExpired;
    case 400:
      return action === "email-code" ? t.invalidCode : t.generic;
    case 403:
      return action === "delete-account" || action === "change-password"
        ? t.wrongPassword
        : t.generic;
    case 409:
      return action === "register" ? t.emailTaken : t.generic;
    case 429:
      return t.tooManyAttempts;
    case 503:
      return action === "email-code" ? t.mailNotSent : t.generic;
    default:
      return t.generic;
  }
}
