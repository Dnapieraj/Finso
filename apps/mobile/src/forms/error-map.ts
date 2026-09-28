import type { z } from "zod";

import { pl } from "../messages/pl";

const t = pl.validation;

/**
 * Turns the Zod issue codes of the shared schemas (which carry no text)
 * into Polish messages. Keyed by field, because the same code means
 * different things: `too_small` is "enter a password" at minimum 1 and
 * "too short" at the registration minimum.
 */
export const plErrorMap: z.core.$ZodErrorMap = (issue) => {
  const field = issue.path?.at(-1);

  if (field === "email") {
    return issue.input === "" ? t.emailRequired : t.emailInvalid;
  }
  if (field === "password") {
    if (issue.code === "too_small") {
      return Number(issue.minimum) <= 1
        ? t.passwordRequired
        : t.passwordTooShort(Number(issue.minimum));
    }
    if (issue.code === "too_big") return t.passwordTooLong(Number(issue.maximum));
  }
  return t.invalid;
};
