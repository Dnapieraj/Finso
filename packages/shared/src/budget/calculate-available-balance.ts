import type {
  CalculateAvailableBalanceInput,
  CalculateAvailableBalanceOutput,
} from './types.js';

/**
 * Ile użytkownik może swobodnie wydać do końca bieżącego okresu
 * budżetowego, po odjęciu stałych zobowiązań (jeszcze nieopłaconych
 * w tym okresie), rat celów oszczędnościowych i już poniesionych
 * wydatków.
 *
 * `availableBalance = periodIncome - Σ remainingFixedCommitments
 *                      - Σ goalContributions - alreadySpent`
 */
export declare function calculateAvailableBalance(
  input: CalculateAvailableBalanceInput,
): CalculateAvailableBalanceOutput;
