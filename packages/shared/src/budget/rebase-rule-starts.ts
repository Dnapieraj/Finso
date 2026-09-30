import { addDays, type IsoDate } from "../date.js";
import { clampedDayInMonth, monthIndexOf, yearMonth } from "./calendar.js";
import { currentBudgetPeriod } from "./period.js";
import type { RecurrenceSchedule } from "./recurrence.js";

/** Reguła w kształcie potrzebnym do przesunięcia jej startu. */
export interface RebasedRule {
  id: string;
  kind: "INCOME" | "EXPENSE";
  frequency: RecurrenceSchedule["frequency"];
  interval: number;
  startDate: IsoDate;
}

/** Wejście {@link rebaseRuleStarts}. */
export interface RebaseRuleStartsOptions {
  /** „Dziś” w strefie użytkownika. */
  today: IsoDate;
  fromPeriodStartDay: number;
  toPeriodStartDay: number;
  /**
   * Dzień ukończenia onboardingu (w strefie użytkownika); `null` = jeszcze
   * nie. Płatności sprzed niego nie ma w wydatkach — krok „ile wydałeś”
   * prosił o pominięcie stałych zobowiązań.
   */
  onboardedOn: IsoDate | null;
}

/**
 * Nowe `startDate` reguł po zmianie dnia wypłaty, żeby żadna płatność
 * bieżącego okresu nie zginęła ani się nie zdublowała.
 *
 * Ginąć mogą tylko wtedy, gdy okres zaczyna się teraz WCZEŚNIEJ: reguła
 * startująca od starego początku okresu nie widzi wystąpień między nowym
 * a starym początkiem. Przy późniejszym początku każde wystąpienie od
 * `startDate` i tak trafia do jakiegoś okresu — nic do zrobienia.
 *
 * Przesuwane są tylko reguły, które obejmowały CAŁY stary okres
 * (`startDate` ≤ jego początku) i zaczynają się po nowym początku:
 * - dochód zawsze — potwierdzone wpływy silnik odejmuje od oczekiwanych,
 *   więc nic się nie zdubluje;
 * - zobowiązanie tylko ze startem nie później niż onboarding. Dodane
 *   później („od dziś”) celowo pomija wcześniejsze płatności: te mogą już
 *   być zapisanymi ręcznie wydatkami.
 *
 * Nowy start to początek nowego okresu. Przy `interval` > 1 start wyznacza
 * fazę (które tygodnie, które miesiące), więc cofamy go o pełne cykle —
 * do ostatniej daty w tej samej fazie nie późniejszej niż nowy początek.
 *
 * Zwraca tylko reguły, którym start się zmienia.
 */
export function rebaseRuleStarts(
  rules: RebasedRule[],
  { today, fromPeriodStartDay, toPeriodStartDay, onboardedOn }: RebaseRuleStartsOptions,
): { id: string; startDate: IsoDate }[] {
  const oldStart = currentBudgetPeriod(today, fromPeriodStartDay).start;
  const newStart = currentBudgetPeriod(today, toPeriodStartDay).start;
  if (newStart >= oldStart) return [];

  return rules
    .filter(
      (rule) =>
        rule.startDate <= oldStart &&
        rule.startDate > newStart &&
        (rule.kind === "INCOME" || (onboardedOn !== null && rule.startDate <= onboardedOn)),
    )
    .map((rule) => ({ id: rule.id, startDate: startInPhase(rule, newStart) }));
}

/** Ostatnia data w fazie reguły, nie późniejsza niż `limit`. */
function startInPhase(rule: RebasedRule, limit: IsoDate): IsoDate {
  // Co tydzień i co miesiąc: dni wyznacza sam dayOfWeek/dayOfMonth.
  if (rule.interval === 1 && rule.frequency !== "YEARLY") return limit;

  if (rule.frequency === "WEEKLY") {
    let date = rule.startDate;
    while (date > limit) date = addDays(date, -7 * rule.interval);
    return date;
  }
  const stepMonths = rule.interval * (rule.frequency === "YEARLY" ? 12 : 1);
  const { day } = yearMonth(rule.startDate);
  let month = monthIndexOf(rule.startDate);
  let date = rule.startDate;
  while (date > limit) {
    month -= stepMonths;
    date = clampedDayInMonth(month, day);
  }
  return date;
}
