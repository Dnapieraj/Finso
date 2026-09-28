import type {
  BudgetSummary,
  Category,
  CreateTransactionRequest,
  TransactionDraft,
  DeleteAccountInput,
  Goal,
  ListTransactionsQuery,
  LoginInput,
  PublicUser,
  RegisterInput,
  Transaction,
  TransactionPage,
} from "@vireo/shared";
import { addExpenseToSummary, grosze } from "@vireo/shared";
import type { ApiClient } from "@vireo/shared/api";

export const testUser: PublicUser = {
  id: "01923b6e-0000-7000-8000-000000000001",
  email: "ola@example.com",
  plan: "FREE",
  currency: "PLN",
  timezone: "Europe/Warsaw",
  periodStartDay: 10,
};

/** Day 19 of 30; 1234,56 zł left for 12 days → 102,88 zł a day. */
export const testBudget: BudgetSummary = {
  period: { start: "2026-09-10", end: "2026-10-09" },
  asOf: "2026-09-28",
  availableBalance: 123_456,
  daysRemaining: 12,
  dailyAllowance: 10_288,
  breakdown: {
    periodIncome: 500_000,
    fixedCommitments: 150_000,
    goalContributions: 50_000,
    alreadySpent: 176_544,
  },
  fixedCommitments: [{ label: "Czynsz", amount: 150_000 }],
  goalContributions: [{ goalId: "01923b6e-0000-7000-8000-000000000010", amount: 50_000 }],
};

/** 1000 zł saved of 4000 zł (25%), due next June. */
export function testGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "01923b6e-0000-7000-8000-000000000010",
    name: "Wakacje",
    targetAmount: 400_000,
    currentAmount: 100_000,
    targetDate: "2027-06-01",
    ...overrides,
  };
}

export const testCategory: Category = {
  id: "01923b6e-0000-7000-8000-000000000020",
  name: "Jedzenie",
  icon: "food",
  color: "#4d7c0f",
  isSystem: true,
};

/** 45,90 zł on food, yesterday. */
export function testTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "01923b6e-0000-7000-8000-000000000030",
    amount: 4_590,
    date: "2026-09-27",
    categoryId: testCategory.id,
    recurringRuleId: null,
    note: null,
    status: "CONFIRMED",
    ...overrides,
  };
}

/** A one-page transaction list, for `mockResolvedValueOnce`. */
export function transactionPage(items: Transaction[]): TransactionPage {
  return { items, nextCursor: null };
}

/**
 * A tiny in-memory server: expenses saved through `create` lower the
 * budget and top the expense list until `remove` takes them out, so a
 * refetch after a save shows what a real API would. Reset before each
 * test by jest.after-env.js.
 */
const saved: Transaction[] = [];
let drafts = 0;

/** Forgets expenses saved and keys handed out in the previous test. */
export function resetFakeServer(): void {
  saved.length = 0;
  drafts = 0;
}

/**
 * Stand-in for `src/api`, mocked in screen tests. The real client
 * (refresh, token storage, schema validation) is covered by the
 * @vireo/shared tests; here only the screens' reactions matter.
 */
export const fakeApi = {
  auth: {
    register: jest.fn((_input: RegisterInput) => Promise.resolve(testUser)),
    login: jest.fn((_input: LoginInput) => Promise.resolve(testUser)),
    logout: jest.fn(() => Promise.resolve()),
  },
  users: {
    me: jest.fn(() => Promise.resolve(testUser)),
    deleteMe: jest.fn((_input: DeleteAccountInput) => Promise.resolve()),
  },
  budget: {
    current: jest.fn(() =>
      Promise.resolve(
        saved.reduce(
          (summary, expense) => addExpenseToSummary(summary, grosze(expense.amount)),
          testBudget,
        ),
      ),
    ),
  },
  goals: {
    list: jest.fn(() => Promise.resolve([testGoal()])),
  },
  categories: {
    list: jest.fn(() => Promise.resolve([testCategory])),
  },
  transactions: {
    list: jest.fn((_query?: Partial<ListTransactionsQuery>) =>
      Promise.resolve(transactionPage([...saved].reverse().concat(testTransaction()).slice(0, 5))),
    ),
    draft: jest.fn((input: CreateTransactionRequest): TransactionDraft => {
      drafts += 1;
      return { input, idempotencyKey: `idempotency-key-${String(drafts)}` };
    }),
    create: jest.fn(({ input }: TransactionDraft) => {
      const expense = testTransaction({
        id: "01923b6e-0000-7000-8000-000000000099",
        amount: input.amount,
        date: input.date,
        categoryId: input.categoryId ?? null,
      });
      saved.push(expense);
      return Promise.resolve(expense);
    }),
    remove: jest.fn((id: string) => {
      const index = saved.findIndex((expense) => expense.id === id);
      if (index !== -1) saved.splice(index, 1);
      return Promise.resolve();
    }),
  },
} satisfies ApiClient;

/** A promise the test settles itself — for "before the server answers" cases. */
export function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** A promise that never settles — for asserting what a screen shows while waiting. */
export function pending<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}
