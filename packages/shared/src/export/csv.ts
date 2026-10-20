const SEPARATOR = ";";
const LINE_END = "\r\n";
/** Bez znacznika BOM Excel czyta UTF-8 jako stronę kodową Windows i psuje „ą”. */
const BOM = String.fromCharCode(0xfeff);

/**
 * Tekst, który arkusz potraktowałby jak formułę (=, +, @, tabulator, minus
 * bez cyfry po nim), dostaje apostrof — notatka „=HIPERŁĄCZE(…)” w pliku
 * z banku czy appki nie może się wykonać. Liczba ujemna („-86,40”) zostaje.
 */
function neutralizeFormula(value: string): string {
  return /^(?:[=+@\t\r]|-(?!\d))/.test(value) ? `'${value}` : value;
}

function cell(value: string): string {
  const safe = neutralizeFormula(value);
  return /[;"\r\n]|^\s|\s$/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * Plik CSV dla polskiego Excela i Arkuszy Google: średnik (przecinek to
 * separator dziesiętny), CRLF, BOM UTF-8. Wartości to gotowy tekst —
 * kwoty z `formatMoney(…, { style: "spreadsheet" })`, daty „RRRR-MM-DD”.
 */
export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(cell).join(SEPARATOR));
  return BOM + lines.map((line) => line + LINE_END).join("");
}
