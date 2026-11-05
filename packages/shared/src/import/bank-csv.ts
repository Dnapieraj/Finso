import { isoDate, type IsoDate } from "../date.js";

/** Wydatek z wyciągu: dodatnia kwota w groszach, data kalendarzowa i opis z banku. */
export interface BankCsvExpense {
  date: IsoDate;
  amount: number;
  note: string | null;
}

/** Wynik {@link parseBankCsv}. */
export type BankCsvResult =
  | {
      ok: true;
      expenses: BankCsvExpense[];
      /** Wiersze pominięte: wpływy, inna waluta niż PLN, nieczytelne daty/kwoty. */
      skipped: { income: number; foreignCurrency: number; invalid: number };
    }
  | { ok: false; reason: "no-columns" };

/** Tyle wierszy od góry przeszukujemy w poszukiwaniu nagłówka (banki dają wstęp). */
const HEADER_SEARCH_LINES = 30;
/** Limit notatki wydatku w API. */
const NOTE_MAX = 500;
const DELIMITERS = [";", ",", "\t"] as const;

const DATE_HEADER = /data|date/;
const PREFERRED_DATE = /operacji|transakcji|^data$|^date$/;
const AMOUNT_HEADER = /kwota|amount/;
const NOT_AMOUNT = /saldo|blokad|balance|walucie/;
const CURRENCY_HEADER = /^(waluta|currency)$/;
const DESCRIPTION_HEADER = /opis|tytu|kontrahent|odbiorc|nadawc|nazwa|description|typ|szczeg/;

interface Columns {
  date: number;
  amount: number;
  currency: number | null;
  description: number[];
}

/**
 * Wydatki z wyciągu CSV dowolnego banku. Szuka wiersza nagłówka (do 30
 * linii od góry — mBank i ING dają wstęp) i separatora (`;`, `,`, tab),
 * potem kolumn po nazwach: data operacji/transakcji, kwota (nie saldo ani
 * blokada), waluta zaraz po kwocie i kolumny opisu (także bez nazwy — PKO
 * dzieli w nich opis). Importuje tylko kwoty ujemne w PLN; kwoty liczone
 * na tekście, bez liczb zmiennoprzecinkowych. Wiersze bez daty (puste,
 * podsumowania) są pomijane po cichu, z błędną datą lub kwotą — liczone.
 */
export function parseBankCsv(text: string): BankCsvResult {
  const lines = text.split(/\r?\n/);
  const found = findHeader(lines);
  if (!found) return { ok: false, reason: "no-columns" };

  const { columns, delimiter, index } = found;
  const expenses: BankCsvExpense[] = [];
  const skipped = { income: 0, foreignCurrency: 0, invalid: 0 };

  for (const line of lines.slice(index + 1)) {
    const cells = splitCsvLine(line, delimiter);
    const rawDate = cell(cells, columns.date);
    if (rawDate === "") continue;

    const date = parseDate(rawDate);
    const amount = parseAmount(cell(cells, columns.amount));
    if (date === null || amount === null || amount.grosze === 0) {
      skipped.invalid += 1;
      continue;
    }
    const currency =
      columns.currency === null
        ? amount.currency
        : cell(cells, columns.currency) || amount.currency;
    if (currency !== null && currency.toUpperCase() !== "PLN") {
      skipped.foreignCurrency += 1;
      continue;
    }
    if (amount.grosze > 0) {
      skipped.income += 1;
      continue;
    }
    expenses.push({ date, amount: -amount.grosze, note: noteOf(cells, columns.description) });
  }
  return { ok: true, expenses, skipped };
}

function findHeader(
  lines: readonly string[],
): { columns: Columns; delimiter: string; index: number } | null {
  for (const [index, line] of lines.slice(0, HEADER_SEARCH_LINES).entries()) {
    for (const delimiter of DELIMITERS) {
      const columns = columnsOf(splitCsvLine(line, delimiter));
      if (columns) return { columns, delimiter, index };
    }
  }
  return null;
}

function columnsOf(cells: readonly string[]): Columns | null {
  const names = cells.map((name) => name.replace(/^#/, "").trim().toLowerCase());
  const preferred = names.findIndex((name) => DATE_HEADER.test(name) && PREFERRED_DATE.test(name));
  const date = preferred === -1 ? names.findIndex((name) => DATE_HEADER.test(name)) : preferred;
  const amount = names.findIndex((name) => AMOUNT_HEADER.test(name) && !NOT_AMOUNT.test(name));
  // Data i kwota w tej samej komórce = zły separator (cała linia w jednym polu).
  if (date === -1 || amount === -1 || date === amount) return null;

  const currency = names.findIndex((name, i) => i > amount && CURRENCY_HEADER.test(name));
  return {
    date,
    amount,
    currency: currency === -1 ? null : currency,
    description: indexesWhere(names, (name, i) =>
      i === date || i === amount ? false : name === "" || DESCRIPTION_HEADER.test(name),
    ),
  };
}

function indexesWhere(
  names: readonly string[],
  test: (name: string, index: number) => boolean,
): number[] {
  return names.flatMap((name, index) => (test(name, index) ? [index] : []));
}

/** Jedna linia CSV: pola w cudzysłowach mogą zawierać separator i `""`. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line.charAt(i);
    if (quoted) {
      if (char === '"' && line.charAt(i + 1) === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function cell(cells: readonly string[], index: number): string {
  return (cells[index] ?? "").trim();
}

/** "2026-10-03", "03.10.2026", "03-10-2026", "03/10/2026" → "2026-10-03"; nieistniejący dzień → null. */
function parseDate(text: string): IsoDate | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const local = /^(\d{2})[.\-/](\d{2})[.\-/](\d{4})$/.exec(text);
  const parts = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : null;
  if (!parts) return null;
  const [year, month, day] = parts.map(Number) as [number, number, number];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return isoDate(
    `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  );
}

/**
 * "-1 299,00 PLN", "+967.01", "−1 050,5", "1,234.56" → grosze ze znakiem
 * i waluta z końca pola (jeśli była). Więcej niż 2 miejsca po przecinku → null.
 */
function parseAmount(text: string): { grosze: number; currency: string | null } | null {
  const currencyMatch = /\s*([A-Za-z]{3})$/.exec(text);
  const number = (currencyMatch ? text.slice(0, currencyMatch.index) : text)
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/\u2212/g, "-");
  // Ostatni z „,” i „.” jest przecinkiem dziesiętnym; drugi to separator tysięcy.
  const decimal = Math.max(number.lastIndexOf(","), number.lastIndexOf("."));
  const normalized =
    decimal === -1
      ? number
      : `${number.slice(0, decimal).replace(/[.,]/g, "")}.${number.slice(decimal + 1)}`;
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const [, sign, whole, fraction = ""] = match;
  const grosze = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return {
    grosze: sign === "-" ? -grosze : grosze,
    currency: currencyMatch?.[1] ?? null,
  };
}

function noteOf(cells: readonly string[], columns: readonly number[]): string | null {
  const note = columns
    .map((index) => cell(cells, index).replace(/\s+/g, " "))
    .filter((part) => part !== "")
    .join(" · ")
    .slice(0, NOTE_MAX);
  return note === "" ? null : note;
}

/**
 * Bajty pliku z banku jako tekst: UTF-8 (z BOM albo bez), a gdy to nie jest
 * poprawny UTF-8 — Windows-1250, w którym eksportuje część polskich banków.
 * Bez TextDecoder: Hermes nie gwarantuje innych kodowań niż UTF-8.
 */
export function decodeBankFile(bytes: Uint8Array): string {
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  return decodeUtf8(bytes.subarray(start)) ?? decodeWindows1250(bytes);
}

/** Ścisły UTF-8 (strumieniowo, bajt po bajcie); `null` przy niepoprawnej sekwencji. */
function decodeUtf8(bytes: Uint8Array): string | null {
  let text = "";
  let pending = 0;
  let code = 0;
  for (const byte of bytes) {
    if (pending > 0) {
      if ((byte & 0xc0) !== 0x80) return null;
      code = (code << 6) | (byte & 0x3f);
      pending -= 1;
      if (pending === 0) text += String.fromCodePoint(code);
    } else if (byte < 0x80) {
      text += String.fromCharCode(byte);
    } else {
      pending = byte >= 0xc2 && byte < 0xe0 ? 1 : byte >= 0xe0 && byte < 0xf0 ? 2 : 3;
      if (byte < 0xc2 || byte >= 0xf5) return null;
      code = byte & (0x3f >> pending);
    }
  }
  return pending === 0 ? text : null;
}

/** Znaki 0x80–0xFF strony kodowej Windows-1250; „�” tam, gdzie znaku nie ma. */
const WINDOWS_1250_HIGH =
  "€�‚�„…†‡�‰Š‹ŚŤŽŹ�‘’“”•–—�™š›śťžź\u00a0ˇ˘Ł¤Ą¦§¨©Ş«¬\u00ad®Ż°±˛ł´µ¶·¸ąş»Ľ˝ľżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙";

function decodeWindows1250(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) {
    text += byte < 0x80 ? String.fromCharCode(byte) : WINDOWS_1250_HIGH.charAt(byte - 0x80);
  }
  return text;
}
