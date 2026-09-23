import type { Grosze } from '../money.js';
import type { SimulatePurchaseInput, SimulatePurchaseOutput } from './types.js';

/**
 * Symuluje planowany zakup: czy stać, ile zostanie, ile dziennie do
 * końca okresu, i o ile opóźni każdy aktywny cel (patrz
 * {@link GoalImpact} po uzasadnienie modelu).
 *
 * Wewnętrznie woła calculateAvailableBalance(input) po stan "przed",
 * więc `input` to dokładnie to samo, czego oczekuje ta funkcja —
 * rozszerzone tylko o cele i próg 'tight'.
 *
 * `categoryId` NIE wpływa dziś na wynik — MVP nie ma limitów per
 * kategoria (nie ma tego w PRODUCT.md dla Fazy 1). Przyjmowany i
 * zwracany bez zmian, żeby sygnatura była gotowa, gdy taka reguła się
 * pojawi, zamiast zmieniać typ publiczny wtedy. Jeśli wolisz to
 * usunąć, dopóki naprawdę nie jest potrzebne — powiedz, wywalę.
 */
export declare function simulatePurchase(
  input: SimulatePurchaseInput,
  amountInGrosze: Grosze,
  categoryId: string,
): SimulatePurchaseOutput;
