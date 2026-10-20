import type {
  AnswerConfirmationRequest,
  BudgetSummary,
  Category,
  CompleteOnboardingInput,
  CreateGoalRequest,
  CreateIncomeSourceRequest,
  CreateRecurringRuleRequest,
  IdempotentDraft,
  CreateTransactionRequest,
  IncomeSource,
  RecurringRule,
  TransactionDraft,
  DeleteAccountInput,
  CreateExpenseTemplateInput,
  ExpenseTemplate,
  UpdateExpenseTemplateInput,
  DueConfirmation,
  Goal,
  ListTransactionsQuery,
  LoginInput,
  PublicUser,
  RegisterInput,
  SimulatePurchaseRequest,
  SimulationResult,
  Transaction,
  TransactionPage,
  TransactionSummary,
  TransactionSummaryQuery,
  UpdateGoalInput,
  UpdateIncomeSourceInput,
  UpdateMeInput,
  UpdateRecurringRuleInput,
  UpdateTransactionInput,
  ConfirmSubscriptionInput,
  ChangePasswordInput,
  ResetPasswordInput,
  ConfirmedSubscriptionOutput,
  DetectedSubscriptionOutput,
  SubscriptionsOverviewOutput,
} from "@vireo/shared";
import { addExpenseToSummary, grosze } from "@vireo/shared";
import { ApiError, type ApiClient } from "@vireo/shared/api";

export const testUser: PublicUser = {
  id: "01923b6e-0000-7000-8000-000000000001",
  email: "ola@example.com",
  plan: "FREE",
  currency: "PLN",
  timezone: "Europe/Warsaw",
  periodStartDay: 10,
  onboardingCompleted: true,
  emailVerified: true,
};

/** The code the fake server accepts for a password reset and an e-mail check. */
export const TEST_EMAIL_CODE = "123456";

const invalidCode = () => Promise.reject(new ApiError("http", 400, "Invalid or expired code"));

/**
 * Day 19 of 30; 1234,56 zł left for 12 days → 102,88 zł a day. Nothing
 * spent today and yesterday went to plan, so today is 102,88 zł as well.
 */
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
  awaitingIncome: 0,
  fixedCommitments: [{ label: "Czynsz", amount: 150_000 }],
  goalContributions: [{ goalId: "01923b6e-0000-7000-8000-000000000010", amount: 50_000 }],
  today: { limit: 10_288, spent: 0, left: 10_288, carriedFromYesterday: 0, nextDays: 10_288 },
};

/** A 120 zł purchase that is easily affordable and touches no goal. */
export function testSimulation(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    canAfford: true,
    riskLevel: "safe",
    before: { availableBalance: 123_456, dailyAllowance: 10_288 },
    remainingAfter: 111_456,
    dailyAllowanceAfter: 9_288,
    goalImpacts: [{ goalId: "01923b6e-0000-7000-8000-000000000010", delayDays: 0 }],
    ...overrides,
  };
}

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
    beforeFinso: false,
    ...overrides,
  };
}

/** „Kawa” for 14 zł on food — a quick add template. */
export function testTemplate(overrides: Partial<ExpenseTemplate> = {}): ExpenseTemplate {
  return {
    id: "01923b6e-0000-7000-8000-000000000060",
    name: "Kawa",
    amount: 1_400,
    categoryId: testCategory.id,
    ...overrides,
  };
}

/** Bills, for commitments; not in the default category list. */
export const billsCategory: Category = {
  id: "01923b6e-0000-7000-8000-000000000022",
  name: "Rachunki",
  icon: "bills",
  color: "#b45309",
  isSystem: true,
};

/** The schedule of the salary: the 10th of every month, from the period start. */
const SALARY_RULE_ID = "01923b6e-0000-7000-8000-000000000041";

/** 5000 zł on the 10th, as set up in onboarding. */
export function testIncomeSource(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: "01923b6e-0000-7000-8000-000000000050",
    name: "Wypłata",
    kind: "REGULAR",
    expectedAmount: 500_000,
    recurringRuleId: SALARY_RULE_ID,
    isActive: true,
    schedule: {
      frequency: "MONTHLY",
      interval: 1,
      startDate: "2026-09-10",
      dayOfMonth: 10,
      dayOfWeek: null,
    },
    ...overrides,
  };
}

/** Rent, 1500 zł on the 5th — the commitment in testBudget. */
export function testRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: "01923b6e-0000-7000-8000-000000000040",
    kind: "EXPENSE",
    name: "Czynsz",
    frequency: "MONTHLY",
    interval: 1,
    startDate: "2026-09-10",
    dayOfMonth: 5,
    dayOfWeek: null,
    expectedAmount: 150_000,
    categoryId: billsCategory.id,
    isActive: true,
    isSubscription: false,
    ...overrides,
  };
}

/** Spotify, 23 zł on the 10th, three payments so far — not yet confirmed. */
export function testDetected(
  overrides: Partial<DetectedSubscriptionOutput> = {},
): DetectedSubscriptionOutput {
  return {
    key: `n|${testCategory.id}|spotify`,
    name: "Spotify",
    categoryId: testCategory.id,
    frequency: "MONTHLY",
    amount: 2_300,
    monthly: 2_300,
    yearly: 27_600,
    paymentsCount: 3,
    lastDate: "2026-09-10",
    nextDate: "2026-10-10",
    priceChange: null,
    ...overrides,
  };
}

/** Netflix, 49 zł a month — a commitment marked as a subscription. */
export function testConfirmed(
  overrides: Partial<ConfirmedSubscriptionOutput> = {},
): ConfirmedSubscriptionOutput {
  return {
    ruleId: "01923b6e-0000-7000-8000-000000000045",
    name: "Netflix",
    categoryId: testCategory.id,
    frequency: "MONTHLY",
    interval: 1,
    amount: 4_900,
    monthly: 4_900,
    yearly: 58_800,
    priceChange: null,
    ...overrides,
  };
}

/** The INCOME rule behind testIncomeSource; the API lists it with the commitments. */
const salaryRule: RecurringRule = testRule({
  id: SALARY_RULE_ID,
  kind: "INCOME",
  name: null,
  dayOfMonth: 10,
  expectedAmount: null,
  categoryId: null,
});

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
/** Expenses that were there before the test: by default the one testTransaction. */
let earlier: Transaction[] = [];
/** Expenses in the trash, with where they came from, so a restore puts them back. */
let trashedExpenses: { expense: Transaction; wasSaved: boolean }[] = [];

/** Every expense not in the trash: saved in this test first, newest first. */
function allExpenses(): Transaction[] {
  return [...saved].reverse().concat(earlier);
}

/** The newest first, like the API: by date, then as they were added. */
function byDateDesc(expenses: Transaction[]): Transaction[] {
  return [...expenses].sort((a, b) => b.date.localeCompare(a.date));
}

function inRange(expense: Transaction, from?: string, to?: string): boolean {
  return (from === undefined || expense.date >= from) && (to === undefined || expense.date <= to);
}
/** Settings of the account; a new account starts before onboarding. */
let account: PublicUser = testUser;
let rules: RecurringRule[] = [];
let sources: IncomeSource[] = [];
let goals: Goal[] = [];
/** Goals in the trash: soft-deleted, so they can come back. */
let trashedGoals: Goal[] = [];
let created = 0;
/** Income and payments waiting for an answer — none unless a test seeds them. */
let due: DueConfirmation[] = [];
/** Quick add templates — none unless a test seeds them. */
let templates: ExpenseTemplate[] = [];
/** Subscriptions — none unless a test seeds them. */
let detected: DetectedSubscriptionOutput[] = [];
let confirmedSubscriptions: ConfirmedSubscriptionOutput[] = [];
let dismissed: DetectedSubscriptionOutput[] = [];

/** Totals like the API: monthly from the yearly sum, rounded up. */
function totalOf(items: { monthly: number; yearly: number }[]) {
  const yearly = items.reduce((sum, item) => sum + item.yearly, 0);
  return { count: items.length, monthly: Math.ceil(yearly / 12), yearly };
}

function subscriptionsOverview(): SubscriptionsOverviewOutput {
  return {
    confirmed: confirmedSubscriptions,
    detected,
    totals: { confirmed: totalOf(confirmedSubscriptions), detected: totalOf(detected) },
  };
}

/** Rent of 1500 zł due on 28.09 (testBudget.asOf), still unanswered. */
export function testDue(overrides: Partial<DueConfirmation> = {}): DueConfirmation {
  return {
    kind: "EXPENSE",
    id: "01923b6e-0000-7000-8000-000000000041",
    label: "Czynsz",
    occurrenceDate: "2026-09-28",
    expectedAmount: 150_000,
    askToday: true,
    overdue: false,
    ...overrides,
  };
}

/** A new id for something the fake server creates. */
function nextId(): string {
  created += 1;
  return `01923b6e-0000-7000-8000-0000000001${String(created).padStart(2, "0")}`;
}

/** Forgets expenses saved, keys handed out and account changes from the previous test. */
export function resetFakeServer(): void {
  saved.length = 0;
  drafts = 0;
  created = 0;
  earlier = [testTransaction()];
  trashedExpenses = [];
  account = testUser;
  rules = [salaryRule, testRule()];
  sources = [testIncomeSource()];
  goals = [testGoal()];
  trashedGoals = [];
  due = [];
  templates = [];
  detected = [];
  confirmedSubscriptions = [];
  dismissed = [];
}

/** A draft with the next key: "idempotency-key-1", "-2"… */
function keyed<T>(input: T): IdempotentDraft<T> {
  drafts += 1;
  return { input, idempotencyKey: `idempotency-key-${String(drafts)}` };
}

/** Replaces what the fake server holds, e.g. to start with no commitments. */
export function seedFakeServer(data: {
  rules?: RecurringRule[];
  sources?: IncomeSource[];
  goals?: Goal[];
  transactions?: Transaction[];
  due?: DueConfirmation[];
  templates?: ExpenseTemplate[];
  detected?: DetectedSubscriptionOutput[];
  confirmedSubscriptions?: ConfirmedSubscriptionOutput[];
}) {
  if (data.detected) detected = data.detected;
  if (data.confirmedSubscriptions) confirmedSubscriptions = data.confirmedSubscriptions;
  if (data.templates) templates = data.templates;
  if (data.transactions) earlier = data.transactions;
  if (data.due) due = data.due;
  if (data.rules) rules = data.rules;
  if (data.sources) sources = data.sources;
  if (data.goals) goals = data.goals;
}

/** The signed-in account has not finished onboarding (e.g. quit halfway last time). */
export function startBeforeOnboarding(): void {
  account = { ...testUser, periodStartDay: 1, onboardingCompleted: false, emailVerified: false };
}

/** The signed-in account has not typed in the code from the e-mail yet. */
export function startUnverified(): void {
  account = { ...account, emailVerified: false };
}

/**
 * Stand-in for `src/api`, mocked in screen tests. The real client
 * (refresh, token storage, schema validation) is covered by the
 * @vireo/shared tests; here only the screens' reactions matter.
 */
export const fakeApi = {
  auth: {
    register: jest.fn((_input: RegisterInput) => {
      startBeforeOnboarding();
      return Promise.resolve(account);
    }),
    login: jest.fn((_input: LoginInput) => Promise.resolve(account)),
    logout: jest.fn(() => Promise.resolve()),
    forgotPassword: jest.fn((_email: string) => Promise.resolve()),
    resetPassword: jest.fn((input: ResetPasswordInput) =>
      input.code === TEST_EMAIL_CODE ? Promise.resolve() : invalidCode(),
    ),
  },
  users: {
    me: jest.fn(() => Promise.resolve(account)),
    updateMe: jest.fn((input: UpdateMeInput) => {
      account = { ...account, ...input };
      return Promise.resolve(account);
    }),
    deleteMe: jest.fn((_input: DeleteAccountInput) => Promise.resolve()),
    completeOnboarding: jest.fn((input: CompleteOnboardingInput) => {
      account = {
        ...account,
        periodStartDay: input.periodStartDay,
        timezone: input.timezone,
        onboardingCompleted: true,
      };
      return Promise.resolve(account);
    }),
    sendEmailVerification: jest.fn(() => Promise.resolve()),
    verifyEmail: jest.fn((code: string) => {
      if (code !== TEST_EMAIL_CODE) return invalidCode();
      account = { ...account, emailVerified: true };
      return Promise.resolve(account);
    }),
    changePassword: jest.fn((_input: ChangePasswordInput) => Promise.resolve()),
  },
  confirmations: {
    list: jest.fn(() => Promise.resolve(due.map((item) => ({ ...item })))),
    // Like the API: an answer closes the item; „Jeszcze nie” keeps it, not asked again today.
    answer: jest.fn((body: AnswerConfirmationRequest) => {
      const id = body.kind === "EXPENSE" ? body.recurringRuleId : body.incomeSourceId;
      const matches = (item: DueConfirmation) =>
        item.id === id && item.occurrenceDate === body.occurrenceDate;
      due =
        body.answer === "NOT_YET"
          ? due.map((item) => (matches(item) ? { ...item, askToday: false } : item))
          : due.filter((item) => !matches(item));
      return Promise.resolve();
    }),
  },
  budget: {
    simulate: jest.fn((_input: SimulatePurchaseRequest) => Promise.resolve(testSimulation())),
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
    // Nearest target date first, like the API.
    list: jest.fn(() =>
      Promise.resolve([...goals].sort((a, b) => a.targetDate.localeCompare(b.targetDate))),
    ),
    draft: jest.fn((input: CreateGoalRequest) => keyed(input)),
    create: jest.fn(({ input }: IdempotentDraft<CreateGoalRequest>) => {
      const goal: Goal = {
        id: nextId(),
        name: input.name,
        targetAmount: input.targetAmount,
        currentAmount: input.currentAmount ?? 0,
        targetDate: input.targetDate,
      };
      goals = [...goals, goal];
      return Promise.resolve(goal);
    }),
    update: jest.fn((id: string, input: UpdateGoalInput) => {
      const current = goals.find((goal) => goal.id === id);
      if (!current) return Promise.reject(new Error(`No goal ${id}`));
      const goal = { ...current, ...input };
      goals = goals.map((other) => (other.id === id ? goal : other));
      return Promise.resolve(goal);
    }),
    remove: jest.fn((id: string) => {
      trashedGoals = [...trashedGoals, ...goals.filter((goal) => goal.id === id)];
      goals = goals.filter((goal) => goal.id !== id);
      return Promise.resolve();
    }),
    restore: jest.fn((id: string) => {
      const goal = trashedGoals.find((trashed) => trashed.id === id);
      if (!goal) return Promise.reject(new Error(`No goal ${id} in the trash`));
      trashedGoals = trashedGoals.filter((trashed) => trashed.id !== id);
      goals = [...goals, goal];
      return Promise.resolve(goal);
    }),
  },
  recurringRules: {
    list: jest.fn(() => Promise.resolve(rules)),
    draft: jest.fn((input: CreateRecurringRuleRequest) => keyed(input)),
    create: jest.fn(({ input }: IdempotentDraft<CreateRecurringRuleRequest>) => {
      const rule: RecurringRule = {
        id: nextId(),
        kind: input.kind,
        name: input.name ?? null,
        frequency: input.frequency,
        interval: input.interval ?? 1,
        startDate: input.startDate,
        dayOfMonth: input.dayOfMonth ?? null,
        dayOfWeek: input.dayOfWeek ?? null,
        expectedAmount: input.expectedAmount ?? null,
        categoryId: input.categoryId ?? null,
        isActive: true,
        isSubscription: input.isSubscription ?? false,
      };
      rules = [...rules, rule];
      return Promise.resolve(rule);
    }),
    update: jest.fn((id: string, input: UpdateRecurringRuleInput) => {
      const current = rules.find((rule) => rule.id === id);
      if (!current) return Promise.reject(new Error(`No rule ${id}`));
      const rule = { ...current, ...input };
      rules = rules.map((other) => (other.id === id ? rule : other));
      return Promise.resolve(rule);
    }),
    remove: jest.fn((id: string) => {
      rules = rules.filter((rule) => rule.id !== id);
      return Promise.resolve();
    }),
  },
  incomeSources: {
    list: jest.fn(() => Promise.resolve(sources)),
    draft: jest.fn((input: CreateIncomeSourceRequest) => keyed(input)),
    create: jest.fn(({ input }: IdempotentDraft<CreateIncomeSourceRequest>) => {
      const schedule = input.schedule
        ? {
            frequency: input.schedule.frequency,
            interval: input.schedule.interval ?? 1,
            startDate: input.schedule.startDate,
            dayOfMonth: input.schedule.dayOfMonth ?? null,
            dayOfWeek: input.schedule.dayOfWeek ?? null,
          }
        : null;
      const source: IncomeSource = {
        id: nextId(),
        name: input.name,
        kind: input.kind,
        expectedAmount: input.expectedAmount ?? null,
        recurringRuleId: schedule ? nextId() : null,
        isActive: true,
        schedule,
      };
      sources = [...sources, source];
      return Promise.resolve(source);
    }),
    update: jest.fn((id: string, input: UpdateIncomeSourceInput) => {
      const current = sources.find((source) => source.id === id);
      if (!current) return Promise.reject(new Error(`No income source ${id}`));
      const { schedule, ...fields } = input;
      const source: IncomeSource = {
        ...current,
        ...fields,
        schedule: schedule === undefined ? current.schedule : schedule,
      };
      sources = sources.map((other) => (other.id === id ? source : other));
      return Promise.resolve(source);
    }),
    remove: jest.fn((id: string) => {
      sources = sources.filter((source) => source.id !== id);
      return Promise.resolve();
    }),
  },
  categories: {
    list: jest.fn(() => Promise.resolve([testCategory])),
  },
  exportData: jest.fn(() =>
    Promise.resolve({
      exportedOn: testBudget.asOf,
      categories: [testCategory],
      expenses: allExpenses().map((expense) => ({ ...expense, occurrenceDate: null })),
      incomeSources: sources,
      incomeEntries: [],
      goals,
      recurringRules: rules,
    }),
  ),
  subscriptions: {
    overview: jest.fn(() => Promise.resolve(subscriptionsOverview())),
    draftConfirm: jest.fn((input: ConfirmSubscriptionInput) => keyed(input)),
    confirm: jest.fn(({ input }: IdempotentDraft<ConfirmSubscriptionInput>) => {
      const item = detected.find((candidate) => candidate.key === input.key);
      if (!item) return Promise.reject(new ApiError("http", 404, "Not Found"));
      const rule: RecurringRule = {
        ...testRule(),
        id: nextId(),
        name: input.name,
        startDate: item.nextDate,
        dayOfMonth: Number(item.nextDate.slice(8)),
        expectedAmount: item.amount,
        categoryId: item.categoryId,
        isSubscription: true,
      };
      rules = [...rules, rule];
      detected = detected.filter((candidate) => candidate !== item);
      confirmedSubscriptions = [
        ...confirmedSubscriptions,
        testConfirmed({
          ruleId: rule.id,
          name: input.name,
          amount: item.amount,
          monthly: item.monthly,
          yearly: item.yearly,
        }),
      ];
      return Promise.resolve(rule);
    }),
    dismiss: jest.fn((key: string) => {
      dismissed = [...dismissed, ...detected.filter((item) => item.key === key)];
      detected = detected.filter((item) => item.key !== key);
      return Promise.resolve();
    }),
    undismiss: jest.fn((key: string) => {
      detected = [...detected, ...dismissed.filter((item) => item.key === key)];
      dismissed = dismissed.filter((item) => item.key !== key);
      return Promise.resolve();
    }),
  },
  expenseTemplates: {
    list: jest.fn(() => Promise.resolve(templates.map((template) => ({ ...template })))),
    create: jest.fn((input: CreateExpenseTemplateInput) => {
      const template: ExpenseTemplate = { id: nextId(), ...input };
      templates = [...templates, template];
      return Promise.resolve(template);
    }),
    update: jest.fn((id: string, input: UpdateExpenseTemplateInput) => {
      const current = templates.find((template) => template.id === id);
      if (!current) return Promise.reject(new Error(`No template ${id}`));
      const template = { ...current, ...input };
      templates = templates.map((other) => (other.id === id ? template : other));
      return Promise.resolve(template);
    }),
    remove: jest.fn((id: string) => {
      templates = templates.filter((template) => template.id !== id);
      return Promise.resolve();
    }),
  },
  transactions: {
    list: jest.fn((query: Partial<ListTransactionsQuery> = {}) => {
      const matching = byDateDesc(allExpenses()).filter(
        (expense) =>
          (query.status === undefined || expense.status === query.status) &&
          (query.categoryId === undefined || expense.categoryId === query.categoryId) &&
          inRange(expense, query.from, query.to),
      );
      const start = query.cursor
        ? matching.findIndex((expense) => expense.id === query.cursor) + 1
        : 0;
      const limit = query.limit ?? 50;
      const items = matching.slice(start, start + limit);
      const more = matching.length > start + limit;
      return Promise.resolve({ items, nextCursor: more ? (items.at(-1)?.id ?? null) : null });
    }),
    summary: jest.fn((query: TransactionSummaryQuery): Promise<TransactionSummary> => {
      const counted = allExpenses().filter(
        (expense) => expense.status === "CONFIRMED" && inRange(expense, query.from, query.to),
      );
      const totals = new Map<string | null, { amount: number; count: number }>();
      for (const expense of counted) {
        const line = totals.get(expense.categoryId) ?? { amount: 0, count: 0 };
        totals.set(expense.categoryId, {
          amount: line.amount + expense.amount,
          count: line.count + 1,
        });
      }
      return Promise.resolve({
        total: counted.reduce((sum, expense) => sum + expense.amount, 0),
        count: counted.length,
        byCategory: [...totals]
          .map(([categoryId, line]) => ({ categoryId, ...line }))
          .sort((a, b) => b.amount - a.amount),
      });
    }),
    get: jest.fn((id: string) => {
      const expense = allExpenses().find((item) => item.id === id);
      return expense
        ? Promise.resolve(expense)
        : Promise.reject(new ApiError("http", 404, "Not Found"));
    }),
    update: jest.fn((id: string, input: UpdateTransactionInput) => {
      const change = (list: Transaction[]) => {
        const index = list.findIndex((item) => item.id === id);
        const current = list[index];
        if (!current) return null;
        const expense: Transaction = {
          ...current,
          ...(input.amount === undefined ? {} : { amount: input.amount }),
          ...(input.date === undefined ? {} : { date: input.date }),
          ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
          ...(input.note === undefined ? {} : { note: input.note }),
        };
        list.splice(index, 1, expense);
        return expense;
      };
      const expense = change(saved) ?? change(earlier);
      return expense ? Promise.resolve(expense) : Promise.reject(new Error(`No expense ${id}`));
    }),
    restore: jest.fn((id: string) => {
      const trashed = trashedExpenses.find((item) => item.expense.id === id);
      if (!trashed) return Promise.reject(new Error(`No expense ${id} in the trash`));
      trashedExpenses = trashedExpenses.filter((item) => item !== trashed);
      if (trashed.wasSaved) saved.push(trashed.expense);
      else earlier = [...earlier, trashed.expense];
      return Promise.resolve(trashed.expense);
    }),
    draft: jest.fn((input: CreateTransactionRequest): TransactionDraft => keyed(input)),
    create: jest.fn(({ input }: TransactionDraft) => {
      const expense = testTransaction({
        id: "01923b6e-0000-7000-8000-000000000099",
        amount: input.amount,
        date: input.date,
        categoryId: input.categoryId ?? null,
        note: input.note ?? null,
      });
      saved.push(expense);
      return Promise.resolve(expense);
    }),
    remove: jest.fn((id: string) => {
      const index = saved.findIndex((expense) => expense.id === id);
      const fromSaved = saved[index];
      if (fromSaved) {
        saved.splice(index, 1);
        trashedExpenses.push({ expense: fromSaved, wasSaved: true });
      }
      const fromEarlier = earlier.find((expense) => expense.id === id);
      if (fromEarlier) {
        earlier = earlier.filter((expense) => expense !== fromEarlier);
        trashedExpenses.push({ expense: fromEarlier, wasSaved: false });
      }
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
