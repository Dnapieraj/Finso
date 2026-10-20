import { addDays, daysBetween, type IsoDate } from "../date.js";
import { grosze, type Grosze } from "../money.js";
import { clampedDayInMonth, dayOfWeekOf, monthIndexOf, yearMonth } from "./calendar.js";
import type { RecurrenceSchedule } from "./recurrence.js";
import type { ConfirmationStatus } from "./occurrences.js";

/** Jak często płaci się subskrypcję — te same jednostki co RecurringRule. */
export type SubscriptionFrequency = RecurrenceSchedule["frequency"];

/** Pojedyncza płatność: data i kwota. */
export interface SubscriptionPayment {
  date: IsoDate;
  amount: Grosze;
}

/**
 * Wydatek z historii użytkownika. Filtrowanie (status, reguła, „przed
 * Finso”, przyszłe daty) robi detektor — warstwa wywołująca pomija tylko
 * usunięte i ogranicza okno do ~400 dni.
 */
export interface SubscriptionExpense extends SubscriptionPayment {
  note: string | null;
  categoryId: string | null;
  status: ConfirmationStatus;
  recurringRuleId: string | null;
  beforeFinso: boolean;
}

/** Aktywna reguła wydatku (stała płatność) użytkownika. */
export interface SubscriptionRule {
  id: string;
  name: string;
  frequency: SubscriptionFrequency;
  interval: number;
  expectedAmount: Grosze;
  categoryId: string | null;
  /** Potwierdzona z detektora albo oznaczona w Ustawieniach — wchodzi do sumy. */
  isSubscription: boolean;
  /** Potwierdzone płatności tej reguły — z nich widać podwyżkę ceny. */
  payments: SubscriptionPayment[];
}

/** Zmiana ceny: „23 zł → 27 zł od marca, +48 zł rocznie”. */
export interface PriceChange {
  from: Grosze;
  to: Grosze;
  /** Pierwsza płatność w nowej cenie. */
  since: IsoDate;
  /** Różnica kosztu rocznego — ujemna przy obniżce. */
  yearlyDelta: number;
}

/** Koszt w przeliczeniu na miesiąc i rok. */
export interface SubscriptionCost {
  monthly: Grosze;
  yearly: Grosze;
}

/** Wykryta, jeszcze niepotwierdzona subskrypcja. */
export interface DetectedSubscription extends SubscriptionCost {
  /** Stały identyfikator grupy — do „To subskrypcja” i „To nie subskrypcja”. */
  key: string;
  /** Notatka z ostatniej płatności; `null` = wydatki bez notatki. */
  name: string | null;
  categoryId: string | null;
  frequency: SubscriptionFrequency;
  /** Kwota ostatniej płatności. */
  amount: Grosze;
  paymentsCount: number;
  lastDate: IsoDate;
  nextDate: IsoDate;
  priceChange: PriceChange | null;
  /** Harmonogram stałej płatności, która powstanie po potwierdzeniu. */
  schedule: RecurrenceSchedule;
}

/** Potwierdzona subskrypcja — reguła wydatku z `isSubscription`. */
export interface ConfirmedSubscription extends SubscriptionCost {
  ruleId: string;
  name: string;
  categoryId: string | null;
  frequency: SubscriptionFrequency;
  interval: number;
  amount: Grosze;
  priceChange: PriceChange | null;
}

/** Wejście {@link subscriptionsOverview}. */
export interface SubscriptionsOverviewInput {
  /** Dziś w strefie użytkownika. */
  asOf: IsoDate;
  expenses: SubscriptionExpense[];
  /** Aktywne reguły wydatków — wszystkie, nie tylko subskrypcje (żeby nie dublować). */
  rules: SubscriptionRule[];
  /** Klucze odrzucone przez „To nie subskrypcja”. */
  dismissedKeys: readonly string[];
}

/** Ekran „Subskrypcje”: potwierdzone, wykryte i osobne sumy. */
export interface SubscriptionsOverview {
  confirmed: ConfirmedSubscription[];
  detected: DetectedSubscription[];
  totals: {
    confirmed: SubscriptionCost & { count: number };
    detected: SubscriptionCost & { count: number };
  };
}

interface Cadence {
  /** Odstęp między kolejnymi płatnościami (dni, włącznie). */
  single: readonly [number, number];
  /** Odstęp z jednym brakującym wpisem; `null` = niedozwolony. */
  gap: readonly [number, number] | null;
  /** Średni odstęp na cykl (brakujący wpis liczy się jako dwa cykle). */
  average: readonly [number, number];
  minPayments: number;
  /** Starsza ostatnia płatność = subskrypcja prawdopodobnie anulowana. */
  maxAgeDays: number;
  perYear: number;
}

// Zakresy są rozłączne, więc ostatni odstęp jednoznacznie wskazuje cykl.
// Miesiąc: 28–31 dni ± przesunięcie dnia o kilka dni w obie strony.
const CADENCES: Record<SubscriptionFrequency, Cadence> = {
  WEEKLY: {
    single: [5, 9],
    gap: [12, 16],
    average: [6, 8],
    minPayments: 4,
    maxAgeDays: 14,
    perYear: 52,
  },
  MONTHLY: {
    single: [22, 38],
    gap: [50, 70],
    average: [26, 34],
    minPayments: 3,
    maxAgeDays: 45,
    perYear: 12,
  },
  YEARLY: {
    single: [350, 380],
    gap: null,
    average: [350, 380],
    minPayments: 2,
    maxAgeDays: 400,
    perYear: 1,
  },
};

const FREQUENCIES: readonly SubscriptionFrequency[] = ["WEEKLY", "MONTHLY", "YEARLY"];

/** Tolerancja „tej samej ceny”: 5% albo 50 gr, co większe. */
const PRICE_TOLERANCE_PERCENT = 5;
const PRICE_TOLERANCE_GROSZE = 50;

/**
 * Nazwa do porównań: małe litery, bez polskich znaków i interpunkcji,
 * bez fragmentów z cyframi („Spotify 03/2026” → „spotify”). `null`, gdy
 * nic nie zostaje — wtedy wydatek idzie ścieżką „bez notatki”.
 */
export function normalizeSubscriptionName(note: string | null): string | null {
  if (note === null) return null;
  const words = note
    .toLowerCase()
    .replaceAll("ł", "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word !== "" && !/\d/.test(word));
  return words.length > 0 ? words.join(" ") : null;
}

/**
 * Czy `next` to wciąż ta sama cena co `previous` — różnica najwyżej
 * 5% poprzedniej ceny albo 50 gr (wahania kursu, zaokrąglenia banku).
 */
export function isSamePrice(previous: Grosze, next: Grosze): boolean {
  const diff = Math.abs(next - previous);
  return diff <= PRICE_TOLERANCE_GROSZE || diff * 100 <= previous * PRICE_TOLERANCE_PERCENT;
}

/**
 * Koszt roczny i miesięczny płatności co `interval` jednostek. Tydzień
 * liczy się jako 1/52 roku. Zaokrąglenie w górę — to koszt, więc
 * bezpieczniej pokazać grosz za dużo niż za mało.
 */
export function subscriptionCost(
  amount: Grosze,
  frequency: SubscriptionFrequency,
  interval = 1,
): SubscriptionCost {
  const yearly = Math.ceil((amount * CADENCES[frequency].perYear) / interval);
  return { yearly: grosze(yearly), monthly: grosze(Math.ceil(yearly / 12)) };
}

/**
 * Ostatnia zmiana ceny w płatnościach (dowolna kolejność). Pojedyncza
 * inna kwota między dwiema takimi samymi to wyjątek, nie zmiana ceny.
 * `null`, gdy cena się nie zmieniła.
 */
export function detectPriceChange(
  payments: readonly SubscriptionPayment[],
  frequency: SubscriptionFrequency,
  interval = 1,
): PriceChange | null {
  const levels = priceLevels(byDate(payments));
  const current = levels.at(-1);
  const previous = levels.at(-2);
  if (!current || !previous) return null;
  const from = previous.last.amount;
  const to = current.last.amount;
  return {
    from,
    to,
    since: current.first.date,
    yearlyDelta:
      subscriptionCost(to, frequency, interval).yearly -
      subscriptionCost(from, frequency, interval).yearly,
  };
}

/**
 * Subskrypcje użytkownika: potwierdzone (reguły z `isSubscription`),
 * wykryte z historii wydatków i osobne sumy. Wykryte pomijają serie
 * pokryte już stałą płatnością i klucze odrzucone przez użytkownika.
 */
export function subscriptionsOverview(input: SubscriptionsOverviewInput): SubscriptionsOverview {
  const confirmed = input.rules
    .filter((rule) => rule.isSubscription)
    .map((rule): ConfirmedSubscription => ({
      ruleId: rule.id,
      name: rule.name,
      categoryId: rule.categoryId,
      frequency: rule.frequency,
      interval: rule.interval,
      amount: rule.expectedAmount,
      ...subscriptionCost(rule.expectedAmount, rule.frequency, rule.interval),
      priceChange: detectPriceChange(rule.payments, rule.frequency, rule.interval),
    }))
    .sort((a, b) => b.monthly - a.monthly || a.name.localeCompare(b.name, "pl"));

  const dismissed = new Set(input.dismissedKeys);
  const detected = detectSeries(input)
    .filter((item) => !dismissed.has(item.key))
    .filter((item) => !input.rules.some((rule) => coversSeries(rule, item)))
    .sort((a, b) => b.monthly - a.monthly || a.key.localeCompare(b.key));

  return {
    confirmed,
    detected,
    totals: { confirmed: totalOf(confirmed), detected: totalOf(detected) },
  };
}

function totalOf(items: readonly SubscriptionCost[]): SubscriptionCost & { count: number } {
  // Miesięczna suma z rocznej, nie z zaokrąglonych pozycji — inaczej
  // „X zł/mies.” × 12 nie dawałoby pokazanej sumy rocznej.
  const yearly = items.reduce((sum, item) => sum + item.yearly, 0);
  return { count: items.length, yearly: grosze(yearly), monthly: grosze(Math.ceil(yearly / 12)) };
}

/** Wydatek już opisany stałą płatnością — tą samą nazwą albo kategorią, cyklem i kwotą. */
function coversSeries(rule: SubscriptionRule, item: DetectedSubscription): boolean {
  if (
    item.name !== null &&
    normalizeSubscriptionName(rule.name) === normalizeSubscriptionName(item.name)
  ) {
    return true;
  }
  return (
    rule.categoryId === item.categoryId &&
    rule.frequency === item.frequency &&
    rule.interval === 1 &&
    isSamePrice(rule.expectedAmount, item.amount)
  );
}

/** Ciąg płatności z zapamiętaną pierwszą i ostatnią — bez indeksowania tablic. */
interface Series<T> {
  items: T[];
  first: T;
  last: T;
}

function seriesOf<T>(item: T): Series<T> {
  return { items: [item], first: item, last: item };
}

/** Wydatek z nazwą do wyświetlenia (notatka bez spacji na brzegach) albo bez nazwy. */
interface LabeledExpense extends SubscriptionExpense {
  label: string | null;
}

interface Group {
  key: string;
  named: boolean;
  expenses: LabeledExpense[];
}

function detectSeries(input: SubscriptionsOverviewInput): DetectedSubscription[] {
  const groups = new Map<string, Group>();
  for (const expense of input.expenses) {
    if (!counts(expense, input.asOf)) continue;
    const note = expense.note?.trim() ?? "";
    const name = normalizeSubscriptionName(note);
    const category = expense.categoryId ?? "";
    const key = name === null ? `a|${category}|${String(expense.amount)}` : `n|${category}|${name}`;
    const group = groups.get(key) ?? { key, named: name !== null, expenses: [] };
    group.expenses.push({ ...expense, label: name === null ? null : note });
    groups.set(key, group);
  }

  return [...groups.values()].flatMap((group) => {
    const whole = detectInGroup(group.key, group.named, group.expenses, input.asOf);
    if (whole) return [whole];
    if (!group.named) return [];
    // Pod jedną nazwą mogą być dwie subskrypcje (np. „Apple” 4,99 i 29,99 zł),
    // których płatności się przeplatają — każdą cenę sprawdzamy osobno.
    return priceClusters(group.expenses).flatMap((cluster) => {
      const key = `${group.key}|${String(cluster.first.amount)}`;
      const found = detectInGroup(key, true, cluster.items, input.asOf);
      return found ? [found] : [];
    });
  });
}

function counts(expense: SubscriptionExpense, asOf: IsoDate): boolean {
  return (
    expense.status === "CONFIRMED" &&
    expense.recurringRuleId === null &&
    !expense.beforeFinso &&
    expense.date <= asOf
  );
}

/** Grupy podobnych kwot, od najmniejszej. */
function priceClusters(expenses: readonly LabeledExpense[]): Series<LabeledExpense>[] {
  const clusters: Series<LabeledExpense>[] = [];
  for (const expense of [...expenses].sort((a, b) => a.amount - b.amount)) {
    const cluster = clusters.at(-1);
    if (cluster && isSamePrice(cluster.first.amount, expense.amount)) {
      cluster.items.push(expense);
    } else {
      clusters.push(seriesOf(expense));
    }
  }
  return clusters;
}

function detectInGroup(
  key: string,
  named: boolean,
  expenses: readonly LabeledExpense[],
  asOf: IsoDate,
): DetectedSubscription | null {
  const sorted = byDate(expenses);
  const [previous, latest] = sorted.slice(-2);
  if (!previous || !latest) return null;
  const interval = daysBetween(previous.date, latest.date);
  // Zakresy cykli są rozłączne, więc ostatni odstęp wskazuje cykl jednoznacznie.
  const frequency = FREQUENCIES.find((item) => cyclesOf(interval, CADENCES[item]) !== null);
  // Bez nazwy łączy wydatki tylko kategoria i kwota — co tydzień i co rok
  // to wtedy zbyt słaby sygnał (np. ten sam bilet raz w tygodniu).
  if (!frequency || (!named && frequency !== "MONTHLY")) return null;
  const cadence = CADENCES[frequency];

  // Najpierw regularna końcówka historii, potem najwyżej jedna zmiana ceny:
  // seria z dwiema zmianami to raczej zakupy w tym samym miejscu.
  const run = priceLevels(trailingRun(sorted, cadence))
    .slice(-2)
    .flatMap((level) => level.items);
  if (
    run.length < cadence.minPayments ||
    !averageFits(run, cadence) ||
    daysBetween(latest.date, asOf) > cadence.maxAgeDays
  ) {
    return null;
  }

  const schedule = nextSchedule(run, latest.date, frequency);
  return {
    key,
    name: latest.label,
    categoryId: latest.categoryId,
    frequency,
    amount: latest.amount,
    ...subscriptionCost(latest.amount, frequency),
    paymentsCount: run.length,
    lastDate: latest.date,
    nextDate: schedule.startDate,
    priceChange: detectPriceChange(run, frequency),
    schedule,
  };
}

/** 1 = zwykły odstęp, 2 = z brakującym wpisem, `null` = nie pasuje do cyklu. */
function cyclesOf(interval: number, cadence: Cadence): 1 | 2 | null {
  if (within(interval, cadence.single)) return 1;
  if (cadence.gap && within(interval, cadence.gap)) return 2;
  return null;
}

/** Od ostatniej płatności wstecz, dopóki odstępy pasują (najwyżej jeden brakujący wpis). */
function trailingRun<T extends SubscriptionPayment>(sorted: readonly T[], cadence: Cadence): T[] {
  const run: T[] = [];
  let gaps = 0;
  for (const payment of [...sorted].reverse()) {
    const [earliest] = run;
    if (earliest) {
      const cycles = cyclesOf(daysBetween(payment.date, earliest.date), cadence);
      if (cycles === null || (cycles === 2 && gaps > 0)) break;
      if (cycles === 2) gaps += 1;
    }
    run.unshift(payment);
  }
  return run;
}

/** Średni odstęp na cykl w zakresie — bez ułamków: rozpiętość vs. cykle × granice. */
function averageFits(run: readonly SubscriptionPayment[], cadence: Cadence): boolean {
  let cycles = 0;
  let span = 0;
  let previous: SubscriptionPayment | undefined;
  for (const payment of run) {
    if (previous) {
      const interval = daysBetween(previous.date, payment.date);
      span += interval;
      // `run` to spójna końcówka z trailingRun (odcięty najwyżej początek),
      // więc każdy odstęp pasuje do cyklu: 2 przy brakującym wpisie, inaczej 1.
      cycles += cyclesOf(interval, cadence) === 2 ? 2 : 1;
    }
    previous = payment;
  }
  return span >= cadence.average[0] * cycles && span <= cadence.average[1] * cycles;
}

/**
 * Kolejne poziomy ceny (chronologicznie). Pojedyncza płatność w innej
 * kwocie między dwoma poziomami tej samej ceny to wyjątek — scalamy.
 */
function priceLevels<T extends SubscriptionPayment>(sorted: readonly T[]): Series<T>[] {
  const levels: Series<T>[] = [];
  for (const payment of sorted) {
    const level = levels.at(-1);
    if (level && isSamePrice(level.last.amount, payment.amount)) {
      level.items.push(payment);
      level.last = payment;
      continue;
    }
    const before = levels.at(-2);
    if (before && level?.items.length === 1 && isSamePrice(before.last.amount, payment.amount)) {
      levels.pop();
      before.items.push(...level.items, payment);
      before.last = payment;
      continue;
    }
    levels.push(seriesOf(payment));
  }
  return levels;
}

/**
 * Harmonogram od następnego terminu. Dzień miesiąca to mediana dni
 * płatności (przesunięcia o kilka dni się znoszą, a kotwica 31. przeżywa
 * luty); tydzień — dzień tygodnia ostatniej płatności.
 */
function nextSchedule(
  run: readonly SubscriptionPayment[],
  latest: IsoDate,
  frequency: SubscriptionFrequency,
): RecurrenceSchedule {
  if (frequency === "WEEKLY") {
    return {
      frequency,
      interval: 1,
      startDate: addDays(latest, 7),
      dayOfMonth: null,
      dayOfWeek: dayOfWeekOf(latest),
    };
  }
  const days = run.map((payment) => yearMonth(payment.date).day).sort((a, b) => a - b);
  // Górna mediana: przy [28, 31] (luty i marzec z kotwicą 31.) wybiera 31.
  const middle = Math.floor(days.length / 2);
  const dayOfMonth = days.reduce((chosen, day, index) => (index === middle ? day : chosen), 0);
  const step = frequency === "MONTHLY" ? 1 : 12;
  return {
    frequency,
    interval: 1,
    startDate: clampedDayInMonth(monthIndexOf(latest) + step, dayOfMonth),
    dayOfMonth,
    dayOfWeek: null,
  };
}

function within(value: number, [min, max]: readonly [number, number]): boolean {
  return value >= min && value <= max;
}

function byDate<T extends SubscriptionPayment>(payments: readonly T[]): T[] {
  return [...payments].sort((a, b) => a.date.localeCompare(b.date));
}
