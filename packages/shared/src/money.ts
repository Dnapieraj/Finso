/**
 * Kwota w groszach. Branded type (nie sam `number`) — nie da się przez
 * pomyłkę przekazać złotówek czy wartości ułamkowej tam, gdzie silnik
 * budżetu oczekuje grosza. Jedyny sposób, żeby go zdobyć, to `grosze()`,
 * które waliduje integer-ność w runtime (typy nie złapią np. wyniku
 * dzielenia dwóch liczb zmiennoprzecinkowych).
 */
export type Grosze = number & { readonly __brand: 'Grosze' };

/**
 * Tworzy wartość typu {@link Grosze}. Rzuca, jeśli `value` nie jest
 * skończoną liczbą całkowitą — pieniądze w tej appce nigdy nie są
 * arytmetyką zmiennoprzecinkową, więc łapiemy to na granicy, nie
 * w środku obliczeń.
 */
export declare function grosze(value: number): Grosze;
