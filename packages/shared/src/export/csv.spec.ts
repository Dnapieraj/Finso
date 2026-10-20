import { describe, expect, it } from "vitest";

import { toCsv } from "./csv.js";

/**
 * CSV dla polskiego Excela i Arkuszy Google: średnik jako separator (przecinek
 * jest separatorem dziesiętnym), CRLF, BOM UTF-8 (inaczej Excel psuje „ą”).
 */
describe("toCsv", () => {
  it("nagłówek i wiersze rozdzielone średnikiem, CRLF, BOM na początku", () => {
    expect(
      toCsv(
        ["Data", "Kwota"],
        [
          ["2026-10-20", "12,50"],
          ["2026-10-21", "-3,00"],
        ],
      ),
    ).toBe("\uFEFFData;Kwota\r\n2026-10-20;12,50\r\n2026-10-21;-3,00\r\n");
  });

  it("bez wierszy: sam nagłówek", () => {
    expect(toCsv(["Data"], [])).toBe("\uFEFFData\r\n");
  });

  it.each([
    ["średnik", "Kawa; ciastko", '"Kawa; ciastko"'],
    ["cudzysłów", 'Kino "Wisła"', '"Kino ""Wisła"""'],
    ["nowa linia", "a\nb", '"a\nb"'],
    ["spacja na brzegu", " Kawa", '" Kawa"'],
  ])("w cudzysłowie, gdy wartość ma %s", (_case, value, cell) => {
    expect(toCsv(["Notatka"], [[value]])).toBe(`\uFEFFNotatka\r\n${cell}\r\n`);
  });

  it.each([
    ["=SUMA(A1:A9)", "'=SUMA(A1:A9)"],
    ["+48 600 000 000", "'+48 600 000 000"],
    ["@kino", "'@kino"],
    ["-prezent", "'-prezent"],
    ["\tukryte", "'\tukryte"],
  ])("tekst wyglądający na formułę nie wykona się w arkuszu: %s", (value, cell) => {
    expect(toCsv(["Notatka"], [[value]])).toBe(`\uFEFFNotatka\r\n${cell}\r\n`);
  });

  it("liczba ujemna zostaje liczbą (minus i cyfra to nie formuła)", () => {
    expect(toCsv(["Kwota"], [["-86,40"]])).toBe("\uFEFFKwota\r\n-86,40\r\n");
  });

  it("pusta wartość to pusta komórka", () => {
    expect(toCsv(["A", "B"], [["", "x"]])).toBe("\uFEFFA;B\r\n;x\r\n");
  });
});
