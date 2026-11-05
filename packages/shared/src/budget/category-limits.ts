import { daysBetween, type IsoDate } from "../date.js";
import { grosze, type Grosze } from "../money.js";
import type { IncomeForecastLine } from "./forecast-irregular-income.js";
import type { ConfirmationStatus } from "./occurrences.js";
import { budgetPeriodAt, currentBudgetPeriod } from "./period.js";

/** Wydatek w kształcie potrzebnym limitom — wiersz Transaction bez reszty pól. */
export interface LimitExpense {
  categoryId: string | null;
  amount: Grosze;
  date: IsoDate;
  status: ConfirmationStatus;
  /** Płatność stałego zobowiązania — tej nie da się „przyciąć” w tym okresie. */
  recurringRuleId: string | null;
  /** „Wydatki przed Finso” z onboardingu — jednorazowa suma, nie nawyk. */
  beforeFinso: boolean;
}

/** Limit kategorii na okres budżetowy (wiersz CategoryLimit). */
export interface CategoryLimitInput {
  categoryId: string;
  amount: Grosze;
}

/**
 * `near` — zostało 20% limitu albo mniej (równo limit to jeszcze nie
 * przekroczenie); `over` — wydano więcej niż limit.
 */
export type CategoryLimitState = "ok" | "near" | "over";

/** Stan jednego limitu w bieżącym okresie. */
export interface CategoryLimitStatus {
  categoryId: string;
  limit: Grosze;
  spent: Grosze;
  /** Ujemne = o tyle przekroczony. */
  left: Grosze;
  /** Ile dziennie do końca okresu (z dzisiejszym), w dół; 0, gdy nic nie zostało. */
  perDayLeft: Grosze;
  state: CategoryLimitState;
}

/** Ułamek limitu, od którego „zostało niewiele”: 1/5 = 20%. */
const NEAR_DIVISOR = 5;

/**
 * Stan każdego limitu w bieżącym okresie. Liczą się wszystkie potwierdzone
 * wydatki okresu w kategorii — także płatności stałych zobowiązań, bo to
 * też wydatek w tej kategorii (jak wykres w Historii). Kolejność jak w `limits`.
 */
export function categoryLimitStatuses(input: {
  limits: readonly CategoryLimitInput[];
  expenses: readonly LimitExpense[];
  today: IsoDate;
  periodStartDay: number;
}): CategoryLimitStatus[] {
  const period = currentBudgetPeriod(input.today, input.periodStartDay);
  const daysLeft = daysBetween(input.today, period.end) + 1;
  const spentBy = sumByCategory(
    input.expenses.filter(
      (expense) =>
        expense.status === "CONFIRMED" &&
        expense.date >= period.start &&
        expense.date <= period.end,
    ),
  );

  return input.limits.map((limit) => {
    const spent = spentBy.get(limit.categoryId) ?? 0;
    const left = limit.amount - spent;
    const state: CategoryLimitState =
      left < 0 ? "over" : left * NEAR_DIVISOR <= limit.amount ? "near" : "ok";
    return {
      categoryId: limit.categoryId,
      limit: limit.amount,
      spent: grosze(spent),
      left: grosze(left),
      perDayLeft: grosze(left > 0 ? Math.floor(left / daysLeft) : 0),
      state,
    };
  });
}

/** Podpowiedź: zwykle tyle w kategorii, w tym okresie spróbuj tyle. */
export interface LeanMonthSuggestion {
  categoryId: string;
  /** Średnio na pełny okres. */
  usual: Grosze;
  /** Proponowany limit — w dół do pełnych 10 zł. */
  suggested: Grosze;
}

/** „Chudy” okres: dochód nieregularny liczony w budżecie wyraźnie poniżej zwykłego. */
export interface LeanMonth {
  /** Ile z dochodów nieregularnych liczy budżet (wpłynęło albo prognoza). */
  counted: Grosze;
  /** Ile zwykle wpływa (suma median). */
  typical: Grosze;
  shortfall: Grosze;
  suggestions: LeanMonthSuggestion[];
}

/** Poniżej 85% zwykłego dochodu okres jest „chudy”. */
const LEAN_PERCENT = 85;
/** Z ilu ostatnich pełnych okresów średnia wydatków — świeże nawyki. */
const USUAL_PERIODS = 3;
/** Kategorie, w których zwykle wydaje się mniej, nie są warte podpowiedzi. */
const MIN_USUAL = 5_000;
/** Więcej niż 30% mniej w miesiąc to nierealny plan. */
const MAX_CUT_PERCENT = 30;
const MAX_SUGGESTIONS = 3;
/** Proponowany limit w pełnych 10 zł. */
const ROUND_TO = 1_000;

/**
 * Czy bieżący okres jest „chudy” i co przyciąć. Dotyczy tylko dochodów
 * nieregularnych z prognozą: budżet liczy z każdego źródła więcej z dwóch
 * — to, co wpłynęło, albo ostrożną prognozę — i porównuje sumę ze zwykłym
 * dochodem (medianą). Poniżej 85% → podpowiedzi dla trzech kategorii
 * o największych zwykłych wydatkach zmiennych: cięcie proporcjonalne do
 * udziału w niedoborze, najwyżej o 30%, w dół do 10 zł. Kategoria, której
 * limit jest już niższy niż podpowiedź, nie jest podpowiadana. `null` —
 * okres nie jest chudy albo nie ma z czym porównać.
 */
export function leanMonth(input: {
  forecasts: readonly IncomeForecastLine[];
  expenses: readonly LimitExpense[];
  limits: readonly CategoryLimitInput[];
  today: IsoDate;
  periodStartDay: number;
  /** Od kiedy Finso prowadzi budżet — wcześniejsze okresy nie są „zwykłe”. */
  trackedSince: IsoDate;
}): LeanMonth | null {
  const counted = input.forecasts.reduce(
    (sum, line) => sum + Math.max(line.received, line.forecast),
    0,
  );
  const typical = input.forecasts.reduce((sum, line) => sum + line.typical, 0);
  if (counted * 100 >= typical * LEAN_PERCENT) return null;

  const shortfall = typical - counted;
  const candidates = usualSpending(input)
    .filter((line) => line.usual >= MIN_USUAL)
    .sort((a, b) => b.usual - a.usual || a.categoryId.localeCompare(b.categoryId))
    .slice(0, MAX_SUGGESTIONS);
  const total = candidates.reduce((sum, line) => sum + line.usual, 0);
  const limitOf = new Map(input.limits.map((limit) => [limit.categoryId, limit.amount]));

  const suggestions = candidates.flatMap((line): LeanMonthSuggestion[] => {
    // Cięcie w górę, limit w dół — podpowiedź nigdy nie obiecuje za dużo.
    const share = Math.ceil((shortfall * line.usual) / total);
    const cut = Math.min(share, Math.ceil((line.usual * MAX_CUT_PERCENT) / 100));
    const suggested = Math.floor((line.usual - cut) / ROUND_TO) * ROUND_TO;
    const existing = limitOf.get(line.categoryId);
    if (existing !== undefined && existing <= suggested) return [];
    return [
      { categoryId: line.categoryId, usual: grosze(line.usual), suggested: grosze(suggested) },
    ];
  });

  return {
    counted: grosze(counted),
    typical: grosze(typical),
    shortfall: grosze(shortfall),
    suggestions,
  };
}

/**
 * Średnie wydatki zmienne w kategoriach z ostatnich pełnych okresów
 * (najwyżej 3) w całości po `trackedSince`. Okres bez wydatków w kategorii
 * liczy się jako zero. Pomija płatności zobowiązań, „Wydatki przed Finso”
 * i wydatki bez kategorii.
 */
function usualSpending(input: {
  expenses: readonly LimitExpense[];
  today: IsoDate;
  periodStartDay: number;
  trackedSince: IsoDate;
}): { categoryId: string; usual: number }[] {
  const periodAt = (offset: number) => budgetPeriodAt(input.today, input.periodStartDay, offset);
  let periods = 0;
  while (periods < USUAL_PERIODS && periodAt(-(periods + 1)).start >= input.trackedSince) {
    periods += 1;
  }
  if (periods === 0) return [];
  const from = periodAt(-periods).start;
  const to = periodAt(-1).end;

  const totals = sumByCategory(
    input.expenses.filter(
      (expense) =>
        expense.status === "CONFIRMED" &&
        expense.recurringRuleId === null &&
        !expense.beforeFinso &&
        expense.date >= from &&
        expense.date <= to,
    ),
  );
  return [...totals].map(([categoryId, sum]) => ({
    categoryId,
    usual: Math.floor(sum / periods),
  }));
}

function sumByCategory(expenses: readonly LimitExpense[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (const expense of expenses) {
    if (expense.categoryId === null) continue;
    sums.set(expense.categoryId, (sums.get(expense.categoryId) ?? 0) + expense.amount);
  }
  return sums;
}
