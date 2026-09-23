import type { IsoDate } from "../date.js";
import type { Grosze } from "../money.js";

/** Poziom ryzyka zaplanowanego zakupu — patrz JSDoc {@link simulatePurchase}. */
export type RiskLevel = "safe" | "tight" | "over";

/** Okres budżetowy. `end` jest inclusive (ostatni dzień okresu, nie dzień po). */
export interface BudgetPeriod {
  start: IsoDate;
  end: IsoDate;
}

/**
 * Stałe zobowiązanie (RecurringRule kind=EXPENSE w Prisma), które w
 * TYM okresie jeszcze nie ma odpowiadającej potwierdzonej Transaction.
 * Zobowiązania już opłacone w tym okresie NIE trafiają tutaj — są
 * już policzone w `alreadySpent`. To dopasowanie (czy dana reguła ma
 * już transakcję w tym okresie) robi warstwa wywołująca, nie ten moduł
 * — silnik budżetu nie wie nic o Transaction/RecurringRule z Prismy.
 */
export interface FixedCommitment {
  /** Do wyświetlenia w breakdown — nie wpływa na liczby. */
  label: string;
  amount: Grosze;
}

/** Jedna linia wkładu w cel oszczędnościowy w tym okresie — wynik {@link calculateGoalContribution} dla danego celu. */
export interface GoalContributionLine {
  goalId: string;
  amount: Grosze;
}

export interface CalculateAvailableBalanceInput {
  /**
   * Prognozowany/oczekiwany dochód na CAŁY bieżący okres. Dla dochodu
   * regularnego to IncomeSource.expectedAmount; dla nieregularnego —
   * wynik forecastIrregularIncome() (poza zakresem etapu 3, osobna
   * funkcja). Ten moduł dostaje już gotową liczbę, nie liczy prognozy.
   */
  periodIncome: Grosze;
  period: BudgetPeriod;
  /**
   * "Dziś" z perspektywy użytkownika (jego lokalna data, nie serwera).
   * Wstrzykiwane jawnie — silnik budżetu NIGDY nie woła Date.now().
   * Patrz uzasadnienie w date.ts.
   */
  asOf: IsoDate;
  remainingFixedCommitments: FixedCommitment[];
  /** Suma wszystkich linii = ile odkłada się na cele w tym okresie. */
  goalContributions: GoalContributionLine[];
  /**
   * Suma potwierdzonych, nieusuniętych wydatków (Transaction.status =
   * CONFIRMED, deletedAt = null) w tym okresie — WŁĄCZNIE z tymi
   * pokrywającymi stałe zobowiązania (stąd remainingFixedCommitments
   * wyklucza już opłacone, żeby nie liczyć ich podwójnie).
   */
  alreadySpent: Grosze;
}

export interface CalculateAvailableBalanceOutput {
  /** Ile zostało do wydania do końca okresu. Może być ujemne. */
  availableBalance: Grosze;
  /**
   * Dni pozostałe w okresie, licząc `asOf` jako dzień 1 (inclusive).
   * Jeśli `asOf` == period.end, to 1 (jeszcze "dzisiaj" się liczy).
   * Jeśli `asOf` > period.end (okres już minął), to 0.
   */
  daysRemaining: number;
  /**
   * `floor(availableBalance / daysRemaining)`. Floor niezależnie od
   * znaku — przy saldzie ujemnym floor daje BARDZIEJ ujemny wynik
   * (bliższy -Infinity), czyli i tak "bezpieczniej" (nigdy nie
   * zaniża, jak bardzo brakuje). 0, gdy daysRemaining = 0 (okres
   * się skończył, nie ma już "dziennej" perspektywy).
   */
  dailyAllowance: Grosze;
  breakdown: {
    periodIncome: Grosze;
    fixedCommitments: Grosze;
    goalContributions: Grosze;
    alreadySpent: Grosze;
  };
}

/** Cel oszczędnościowy w kształcie potrzebnym symulatorowi (patrz też {@link GoalContributionInput}). */
export interface SimulatedGoal {
  id: string;
  targetAmount: Grosze;
  currentAmount: Grosze;
  targetDate: IsoDate;
}

export interface GoalImpact {
  goalId: string;
  /**
   * O ile dni opóźni się ten cel, GDYBY cały niedobór spowodowany tym
   * zakupem (do wysokości tego, co w tym okresie i tak planowo szło
   * na ten cel) pochodził właśnie z jego wkładu. Liczone NIEZALEŻNIE
   * per cel (nie proporcjonalnie rozdzielane między cele).
   * 0, jeśli zakup nie tworzy niedoboru, cel jest już osiągnięty, albo
   * jego termin już minął (nie da się policzyć względnego opóźnienia
   * względem terminu, który już był).
   *
   * ZNANE UPROSZCZENIE MVP: przy N zagrożonych celach jednocześnie ta
   * tablica pokaże PEŁNE opóźnienie dla KAŻDEGO z osobna (każdy liczony
   * tak, jakby to on jeden wchłonął cały deficyt, capped do własnego
   * wkładu w tym okresie) — nie jeden spójny scenariusz, w którym
   * deficyt jest rozdzielony między cele. Liczby z różnych wpisów NIE
   * sumują się do realnego stanu budżetu. Przykład: deficyt 1300 zł,
   * cel A miał dostać 1000 zł/okres, cel B 800 zł/okres — apka pokaże
   * "+31 dni" dla A ORAZ "+29 dni" dla B jednocześnie, mimo że
   * rzeczywiście brakuje tylko jednej kwoty (1300 zł), nie 1800 zł.
   * Świadomy wybór (prostszy do policzenia i przetestowania niż
   * proporcjonalna atrybucja) — zaakceptowany na Fazę 1, do rewizji
   * w Fazie 2 (patrz docs/PRODUCT.md, sekcja "Znane uproszczenia").
   */
  delayDays: number;
}

export interface SimulatePurchaseInput extends CalculateAvailableBalanceInput {
  goals: SimulatedGoal[];
  /**
   * Próg spadku dziennego budżetu (0-1), powyżej którego zakup, mimo
   * że "stać", oznaczamy jako 'tight' zamiast 'safe'. Domyślnie 0.5
   * (dzienny budżet po zakupie spada o więcej niż połowę). Parametr,
   * nie stała na sztywno — łatwo dostroić bez zmiany kodu i łatwo
   * przetestować graniczne wartości.
   */
  tightThresholdRatio?: number;
}

export interface SimulatePurchaseOutput {
  canAfford: boolean;
  /** availableBalance (z calculateAvailableBalance na tym samym `input`) pomniejszone o kwotę zakupu. */
  remainingAfter: Grosze;
  dailyAllowanceAfter: Grosze;
  goalImpacts: GoalImpact[];
  riskLevel: RiskLevel;
}

export interface GoalContributionInput {
  targetAmount: Grosze;
  currentAmount: Grosze;
}

export interface GoalContributionOutput {
  /**
   * Ile odłożyć w NAJBLIŻSZYM okresie. Zaokrąglone W GÓRĘ (celowo
   * odwrotnie niż dailyAllowance) — zaokrąglenie w dół przy składce
   * na cel systematycznie zaniżałoby oszczędności i cel nigdy by się
   * nie domknął co do grosza.
   */
  contributionPerPeriod: Grosze;
  /** targetAmount <= currentAmount — cel już osiągnięty, contributionPerPeriod = 0. */
  alreadyReached: boolean;
  /**
   * periodsRemaining <= 0, a cel NIE jest jeszcze osiągnięty — termin
   * minął albo kończy się teraz, a wciąż brakuje pieniędzy. W tym
   * wypadku contributionPerPeriod to CAŁA brakująca kwota (nie ma już
   * przyszłych okresów, na które można by ją rozłożyć).
   */
  isOverdue: boolean;
}
