import type { IsoDate } from "../date.js";
import { grosze, type Grosze } from "../money.js";
import type { BudgetIncomeSource, BudgetSnapshot } from "./assemble-budget-input.js";
import { budgetPeriodAt, currentBudgetPeriod } from "./period.js";
import type { BudgetPeriod } from "./types.js";

/** Mniej pełnych okresów to za mało, żeby mówić o „typowym” dochodzie. */
const MIN_PERIODS = 3;
/** Pół roku: dość, żeby złapać wahania, i dość świeżo, żeby nie wlec starych stawek. */
const MAX_PERIODS = 6;

/** Ostrożna prognoza dochodu na okres i zakres, z którego wynika. */
export interface IrregularIncomeForecast {
  /** 25. percentyl sum z pełnych okresów — kwota, którą prawie zawsze się osiąga. */
  forecast: Grosze;
  /** Z ilu pełnych okresów (3–6). */
  periods: number;
  low: Grosze;
  high: Grosze;
  /** Mediana — ile zwykle wpływa; z nią porównujemy „chudy” okres. */
  typical: Grosze;
}

/** Prognoza jednego źródła w bieżącym okresie — do pokazania wprost. */
export interface IncomeForecastLine extends IrregularIncomeForecast {
  incomeSourceId: string;
  name: string;
  /** Ile już wpłynęło w bieżącym okresie. */
  received: Grosze;
  /** Ile z prognozy jeszcze nie wpłynęło (0, gdy wpłynęło więcej). */
  notYetReceived: Grosze;
}

/**
 * Ostrożna prognoza dochodu nieregularnego na okres: 25. percentyl sum
 * potwierdzonych wpływów z ostatnich pełnych okresów (najwyżej 6). Okres
 * bez wpływów liczy się jako zero — to też typowy miesiąc. Liczą się tylko
 * okresy w całości po `trackedSince`; mniej niż 3 → `null` (za mało
 * historii, budżet liczy wtedy tylko to, co wpłynęło).
 *
 * `entries` — potwierdzone wpływy jednego źródła (dowolny zakres dat).
 */
export function forecastIrregularIncome(input: {
  entries: readonly { date: IsoDate; amount: Grosze }[];
  today: IsoDate;
  periodStartDay: number;
  trackedSince?: IsoDate;
}): IrregularIncomeForecast | null {
  const periods: BudgetPeriod[] = [];
  for (let offset = -1; offset >= -MAX_PERIODS; offset -= 1) {
    const period = budgetPeriodAt(input.today, input.periodStartDay, offset);
    if (input.trackedSince !== undefined && period.start < input.trackedSince) break;
    periods.push(period);
  }
  if (periods.length < MIN_PERIODS) return null;

  const totals = periods
    .map((period) =>
      input.entries
        .filter((entry) => entry.date >= period.start && entry.date <= period.end)
        .reduce((sum, entry) => sum + entry.amount, 0),
    )
    .sort((a, b) => a - b);
  // Nearest-rank w dół: przy 3–4 okresach to najniższy, przy 5–6 drugi najniższy.
  const rank = Math.floor((totals.length - 1) / 4);
  return {
    forecast: grosze(totals.slice(rank, rank + 1).reduce((sum, total) => sum + total, 0)),
    periods: totals.length,
    low: grosze(Math.min(...totals)),
    high: grosze(Math.max(...totals)),
    typical: grosze(median(totals)),
  };
}

/** Mediana posortowanych rosnąco sum; przy parzystej liczbie średnia środkowych, w dół. */
function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  const middle =
    sorted.length % 2 === 1 ? sorted.slice(mid, mid + 1) : sorted.slice(mid - 1, mid + 1);
  return Math.floor(middle.reduce((sum, total) => sum + total, 0) / middle.length);
}

/**
 * Prognozy aktywnych źródeł nieregularnych w bieżącym okresie. Źródła bez
 * prognozy (za mało historii) się nie pojawiają.
 */
export function incomeForecasts(snapshot: BudgetSnapshot): IncomeForecastLine[] {
  const period = currentBudgetPeriod(snapshot.today, snapshot.periodStartDay);
  return snapshot.incomeSources.flatMap((source): IncomeForecastLine[] => {
    if (source.kind !== "IRREGULAR" || !source.isActive) return [];
    const confirmed = confirmedEntriesOf(snapshot, source);
    const forecast = forecastIrregularIncome({
      entries: confirmed,
      today: snapshot.today,
      periodStartDay: snapshot.periodStartDay,
      trackedSince: source.trackedSince ?? snapshot.trackedSince,
    });
    if (!forecast) return [];
    const received = confirmed
      .filter((entry) => entry.date >= period.start && entry.date <= period.end)
      .reduce((sum, entry) => sum + entry.amount, 0);
    return [
      {
        incomeSourceId: source.id,
        name: source.name,
        ...forecast,
        received: grosze(received),
        notYetReceived: grosze(Math.max(0, forecast.forecast - received)),
      },
    ];
  });
}

function confirmedEntriesOf(snapshot: BudgetSnapshot, source: BudgetIncomeSource) {
  return snapshot.incomeEntries.filter(
    (entry) => entry.incomeSourceId === source.id && entry.status === "CONFIRMED",
  );
}
