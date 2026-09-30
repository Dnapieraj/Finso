import {
  isValidTimeZone,
  parseMoneyInput,
  type Category,
  type Grosze,
  type MoneyInputError,
  type OnboardingIncome,
} from "@vireo/shared";

import { pl } from "../messages/pl";

const t = pl.onboarding;

/** Longest income or commitment name the API accepts. */
const NAME_MAX = 100;

/** A commitment added on step 3, already validated. */
export interface CommitmentDraft {
  /** Tells rows apart: two commitments may share a name. */
  id: number;
  name: string;
  amount: Grosze;
  dayOfMonth: number;
  category: Category;
}

export type IncomeKind = OnboardingIncome["kind"];

/**
 * Answers so far, kept in memory across the steps (Back keeps them) and
 * never on disk: quitting halfway starts onboarding again from step 1.
 * Text fields hold what was typed; `income` is the validated step 2.
 */
export interface OnboardingDraft {
  periodStartDay: number | null;
  incomeKind: IncomeKind;
  /** `null` = the default name for the kind, until the user types one. */
  incomeName: string | null;
  incomeAmount: string;
  /** `null` = follows the payday, until the user types a day. */
  incomeDay: string | null;
  received: string;
  /** Step 2 after validation; `null` until "Dalej" on step 2. */
  income: OnboardingIncome | null;
  commitments: CommitmentDraft[];
  spent: string;
}

export const emptyDraft: OnboardingDraft = {
  periodStartDay: null,
  incomeKind: "REGULAR",
  incomeName: null,
  incomeAmount: "",
  incomeDay: null,
  received: "",
  income: null,
  commitments: [],
  spent: "",
};

/** Polish message for a money field. */
export function amountError(reason: MoneyInputError): string {
  return pl.addExpense.amountErrors[reason];
}

/** Day of the month 1–31 typed as digits; `null` for anything else. */
export function parseDayOfMonth(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const day = Number(trimmed);
  return day >= 1 && day <= 31 ? day : null;
}

/** The income name shown in the field: typed, or the default for the kind. */
export function incomeNameShown(draft: OnboardingDraft): string {
  return draft.incomeName ?? t.income.defaultName[draft.incomeKind];
}

/** The income day shown in the field: typed, or the payday. */
export function incomeDayShown(draft: OnboardingDraft): string {
  return draft.incomeDay ?? (draft.periodStartDay === null ? "" : String(draft.periodStartDay));
}

export interface IncomeErrors {
  name?: string;
  amount?: string;
  day?: string;
  received?: string;
}

/**
 * Step 2 → the income the API expects, or a message per field. A name
 * cleared by hand falls back to the default: the source must have one.
 */
export function validateIncome(
  draft: OnboardingDraft,
): { ok: true; income: OnboardingIncome } | { ok: false; errors: IncomeErrors } {
  const errors: IncomeErrors = {};
  const name = incomeNameShown(draft).trim() || t.income.defaultName[draft.incomeKind];
  if (name.length > NAME_MAX) errors.name = t.income.nameTooLong;

  if (draft.incomeKind === "REGULAR") {
    const amount = parseMoneyInput(draft.incomeAmount);
    if (!amount.ok) errors.amount = amountError(amount.reason);
    const day = parseDayOfMonth(incomeDayShown(draft));
    if (day === null) errors.day = t.dayError;
    if (!amount.ok || day === null || errors.name) return { ok: false, errors };
    return { ok: true, income: { kind: "REGULAR", name, amount: amount.grosze, dayOfMonth: day } };
  }

  const received = parseOptionalAmount(draft.received);
  if (!received.ok) errors.received = received.message;
  if (!received.ok || errors.name) return { ok: false, errors };
  return { ok: true, income: { kind: "IRREGULAR", name, receivedThisPeriod: received.grosze } };
}

/** An optional money field: empty is `null`, anything typed must be a valid amount. */
export function parseOptionalAmount(
  text: string,
): { ok: true; grosze: Grosze | null } | { ok: false; message: string } {
  if (text.trim() === "") return { ok: true, grosze: null };
  const parsed = parseMoneyInput(text);
  return parsed.ok
    ? { ok: true, grosze: parsed.grosze }
    : { ok: false, message: amountError(parsed.reason) };
}

let lastCommitmentId = 0;

export interface CommitmentFields {
  name: string;
  amount: string;
  day: string;
  category: Category | null;
}

/** Step 3 form → a commitment for the list, or a message per field. */
export function validateCommitment(
  fields: CommitmentFields,
):
  | { ok: true; commitment: CommitmentDraft }
  | { ok: false; errors: Partial<Record<keyof CommitmentFields, string>> } {
  const errors: Partial<Record<keyof CommitmentFields, string>> = {};
  const name = fields.name.trim();
  if (name === "") errors.name = t.commitments.nameRequired;
  else if (name.length > NAME_MAX) errors.name = t.income.nameTooLong;
  const amount = parseMoneyInput(fields.amount);
  if (!amount.ok) errors.amount = amountError(amount.reason);
  const day = parseDayOfMonth(fields.day);
  if (day === null) errors.day = t.dayError;
  if (fields.category === null) errors.category = t.commitments.categoryRequired;

  if (errors.name || !amount.ok || day === null || fields.category === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    commitment: {
      id: ++lastCommitmentId,
      name,
      amount: amount.grosze,
      dayOfMonth: day,
      category: fields.category,
    },
  };
}

/**
 * The phone's time zone, which decides "today" in the budget. Hermes
 * should always know it; the fallback covers an engine that does not.
 */
export function deviceTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(zone) ? zone : "Europe/Warsaw";
}
