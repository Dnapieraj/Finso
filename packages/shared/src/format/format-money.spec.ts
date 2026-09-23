import { describe, expect, it } from "vitest";

import { grosze, type Grosze } from "../money.js";
import { formatMoney, type FormatMoneyOptions } from "./format-money.js";

// Nierozdzielająca spacja (U+00A0) — w oczekiwaniach piszemy ją jawnie,
// bo zwykła spacja w tym miejscu to błąd, którego nie widać gołym okiem.
const S = "\u00A0";

// Omija typ Grosze, żeby dojść do walidacji w runtime.
const unchecked = (value: number) => value as Grosze;

describe("formatMoney", () => {
  describe("format podstawowy (z groszami)", () => {
    it.each([
      [8640, `86,40${S}zł`],
      [5, `0,05${S}zł`],
      [50, `0,50${S}zł`],
      [0, `0,00${S}zł`],
      [100, `1,00${S}zł`],
    ])("%i gr → %s", (amount, expected) => {
      expect(formatMoney(grosze(amount))).toBe(expected);
    });

    it("nie grupuje liczb czterocyfrowych (polska norma, tak jak Intl pl-PL)", () => {
      expect(formatMoney(grosze(120960))).toBe(`1209,60${S}zł`);
    });

    it("grupuje od pięciu cyfr nierozdzielającą spacją", () => {
      expect(formatMoney(grosze(1209600))).toBe(`12${S}096,00${S}zł`);
      expect(formatMoney(grosze(123456789))).toBe(`1${S}234${S}567,89${S}zł`);
    });

    it("nigdy nie używa zwykłej spacji, więc kwota nie złamie się między wierszami", () => {
      expect(formatMoney(grosze(123456789))).not.toContain(" ");
    });

    it("jest dokładny dla największej bezpiecznej liczby całkowitej", () => {
      // Dzielenie przez 100 na liczbach zmiennoprzecinkowych zgubiłoby tu grosze.
      expect(formatMoney(grosze(Number.MAX_SAFE_INTEGER))).toBe(
        `90${S}071${S}992${S}547${S}409,91${S}zł`,
      );
    });
  });

  describe("kwoty ujemne (ujemne saldo)", () => {
    it.each([
      [-8640, `-86,40${S}zł`],
      [-5, `-0,05${S}zł`],
      [-120960, `-1209,60${S}zł`],
      [-1209600, `-12${S}096,00${S}zł`],
    ])("%i gr → %s", (amount, expected) => {
      expect(formatMoney(grosze(amount))).toBe(expected);
    });

    it("pokazuje ujemne zero jako „0,00 zł”, bez minusa", () => {
      // Intl.NumberFormat zwróciłby tu „-0,00 zł”.
      expect(formatMoney(grosze(-0))).toBe(`0,00${S}zł`);
    });
  });

  describe("sign: 'always'", () => {
    it.each([
      [4250, `+42,50${S}zł`],
      [-4250, `-42,50${S}zł`],
      [0, `0,00${S}zł`],
      [-0, `0,00${S}zł`],
    ])("%i gr → %s", (amount, expected) => {
      expect(formatMoney(grosze(amount), { sign: "always" })).toBe(expected);
    });
  });

  describe("whole: 'down' — w stronę -∞, dla środków do wydania", () => {
    it.each([
      [8699, `86${S}zł`],
      [8600, `86${S}zł`],
      [99, `0${S}zł`],
      [0, `0${S}zł`],
      [-8640, `-87${S}zł`],
      [-8600, `-86${S}zł`],
      [-1, `-1${S}zł`],
      [1209699, `12${S}096${S}zł`],
    ])("%i gr → %s", (amount, expected) => {
      expect(formatMoney(grosze(amount), { whole: "down" })).toBe(expected);
    });
  });

  describe("whole: 'up' — w stronę +∞, dla kosztów", () => {
    it.each([
      [2601, `27${S}zł`],
      [2600, `26${S}zł`],
      [1, `1${S}zł`],
      [0, `0${S}zł`],
      [-8640, `-86${S}zł`],
      [-1, `0${S}zł`],
      [-99, `0${S}zł`],
    ])("%i gr → %s", (amount, expected) => {
      expect(formatMoney(grosze(amount), { whole: "up" })).toBe(expected);
    });
  });

  it("łączy pełne złote ze znakiem", () => {
    expect(formatMoney(grosze(4250), { whole: "down", sign: "always" })).toBe(`+42${S}zł`);
    // -0,01 zł w górę to zero, a zero nie dostaje znaku.
    expect(formatMoney(grosze(-1), { whole: "up", sign: "always" })).toBe(`0${S}zł`);
  });

  describe("walidacja wejścia", () => {
    it.each([12.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      "rzuca TypeError dla %d",
      (value) => {
        // Sam TypeError nie wystarczy: "x is not a function" też nim jest.
        expect(() => formatMoney(unchecked(value))).toThrow(TypeError);
        expect(() => formatMoney(unchecked(value))).toThrow(/całkowit/);
      },
    );

    it("rzuca RangeError poza bezpiecznym zakresem liczb całkowitych", () => {
      expect(() => formatMoney(unchecked(2 ** 53))).toThrow(RangeError);
      expect(() => formatMoney(unchecked(-(2 ** 53)))).toThrow(RangeError);
    });
  });
});

describe("formatMoney a Intl.NumberFormat pl-PL (wyrocznia)", () => {
  // Intl przyjmuje dokładny zapis dziesiętny jako string od ES2023;
  // lib tego pakietu to ES2022, stąd zawężony typ funkcji.
  type DecimalFormat = (value: string) => string;
  type OracleOptions = Intl.NumberFormatOptions & {
    roundingMode?: "floor" | "ceil";
    signDisplay?: "auto" | "exceptZero";
  };

  const oracle = (options: OracleOptions): DecimalFormat => {
    const nf = new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      ...options,
    });
    return nf.format.bind(nf) as unknown as DecimalFormat;
  };

  /** Grosze jako dokładny string złotówek, np. -8640 → "-86.40", bez floatów. */
  const toDecimal = (amount: number): string => {
    const abs = Math.abs(amount);
    const zloty = Math.trunc(abs / 100);
    const rest = String(abs % 100).padStart(2, "0");
    return `${amount < 0 ? "-" : ""}${zloty}.${rest}`;
  };

  /** Deterministyczne kwoty od groszy do biliardów, obu znaków. */
  const samples = (() => {
    let seed = 20260923;
    const next = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed / 2 ** 32;
    };
    const values: number[] = [];
    for (let digits = 1; digits <= 15; digits += 1) {
      for (let i = 0; i < 100; i += 1) {
        const value = Math.floor(next() * 10 ** digits);
        values.push(value, -value);
      }
    }
    return values;
  })();

  const cases: readonly [string, FormatMoneyOptions, OracleOptions][] = [
    ["z groszami", {}, {}],
    ["ze znakiem", { sign: "always" }, { signDisplay: "exceptZero" }],
    [
      "pełne złote w dół",
      { whole: "down" },
      { minimumFractionDigits: 0, maximumFractionDigits: 0, roundingMode: "floor" },
    ],
    [
      "pełne złote w górę",
      { whole: "up" },
      { minimumFractionDigits: 0, maximumFractionDigits: 0, roundingMode: "ceil" },
    ],
  ];

  it.each(cases)("zgadza się z Intl dla %s", (_name, options, oracleOptions) => {
    const format = oracle(oracleOptions);
    const mismatches = samples
      .map((amount) => {
        // Jedyne celowe odstępstwo od Intl: ujemne zero piszemy bez minusa.
        const expected = format(toDecimal(amount)).replace(/^-0(?=\u00A0)/, "0");
        const actual = formatMoney(grosze(amount), options);
        return { amount, expected, actual };
      })
      .filter(({ expected, actual }) => expected !== actual);

    expect(mismatches).toEqual([]);
  });
});
