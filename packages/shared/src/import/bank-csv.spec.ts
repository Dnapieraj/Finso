import { describe, expect, it } from "vitest";

import { decodeBankFile, parseBankCsv } from "./bank-csv.js";

/**
 * Import wyciągu CSV z banku (PRODUCT.md, Faza 2, punkt 19). Każdy bank ma
 * swój układ, więc parser szuka wiersza nagłówka i kolumn po nazwach: data
 * operacji, kwota, opis. Importujemy tylko wydatki (kwoty ujemne) w PLN.
 */

describe("parseBankCsv", () => {
  it("mBank: wstęp przed nagłówkiem, średniki, przecinek dziesiętny, spacje w tysiącach", () => {
    const csv = [
      "mBank S.A. Bankowość Detaliczna;",
      "Lista operacji;",
      "",
      "#Data operacji;#Opis operacji;#Rachunek;#Kategoria;#Kwota;#Saldo po operacji;",
      '2026-10-03;"BIEDRONKA 1234 WARSZAWA";"eKonto 1111";"Żywność";-45,90 PLN;1 954,10 PLN;',
      '2026-10-05;"WYNAGRODZENIE";"eKonto 1111";"Wpływy";5 000,00 PLN;6 954,10 PLN;',
      '2026-10-07;"MEDIA MARKT";"eKonto 1111";"Elektronika";-1 299,00 PLN;5 655,10 PLN;',
      "",
      ";;;#Saldo końcowe;5 655,10 PLN;",
    ].join("\n");

    expect(parseBankCsv(csv)).toEqual({
      ok: true,
      expenses: [
        { date: "2026-10-03", amount: 4_590, note: "BIEDRONKA 1234 WARSZAWA" },
        { date: "2026-10-07", amount: 129_900, note: "MEDIA MARKT" },
      ],
      skipped: { income: 1, foreignCurrency: 0, invalid: 0 },
    });
  });

  it("PKO BP: przecinki, cudzysłowy, osobna kolumna waluty, opis w kilku kolumnach", () => {
    const csv = [
      '"Data operacji","Data waluty","Typ transakcji","Kwota","Waluta","Saldo po transakcji","Opis transakcji","",""',
      '"2026-10-02","2026-10-02","Płatność kartą","-12.99","PLN","+987.01","Tytuł: 000498 ŻABKA Z1234","Lokalizacja: Adres: ul. Prosta 1",""',
      '"2026-10-04","2026-10-04","Płatność kartą","-20.00","EUR","+967.01","Tytuł: HOTEL WIEN","",""',
    ].join("\n");

    expect(parseBankCsv(csv)).toEqual({
      ok: true,
      expenses: [
        {
          date: "2026-10-02",
          amount: 1_299,
          note: "Płatność kartą · Tytuł: 000498 ŻABKA Z1234 · Lokalizacja: Adres: ul. Prosta 1",
        },
      ],
      skipped: { income: 0, foreignCurrency: 1, invalid: 0 },
    });
  });

  it("ING: daty dd.mm.rrrr, kontrahent i tytuł, kwota transakcji, a nie saldo", () => {
    const csv = [
      '"Lista transakcji"',
      '"Dokument nr 1"',
      '"Data transakcji";"Data księgowania";"Dane kontrahenta";"Tytuł";"Nr rachunku";"Nazwa banku";"Szczegóły";"Nr transakcji";"Kwota transakcji (waluta rachunku)";"Waluta";"Kwota blokady/zwolnienie blokady";"Waluta";"Kwota płatności w walucie";"Waluta";"Konto";"Saldo po transakcji";"Waluta"',
      '"28.09.2026";"29.09.2026";"ORLEN STACJA 123";"Płatność kartą 27.09.2026";"";"";"";"\'123\'";"-250,01";"PLN";"";"";"";"";"Konto Direct";"1 000,00";"PLN"',
    ].join("\n");

    expect(parseBankCsv(csv)).toMatchObject({
      ok: true,
      expenses: [
        {
          date: "2026-09-28",
          amount: 25_001,
          note: "ORLEN STACJA 123 · Płatność kartą 27.09.2026",
        },
      ],
    });
  });

  it("ogólny CSV: date, amount, description po angielsku", () => {
    const csv = [
      "Date,Description,Amount",
      "2026-10-01,Coffee,-14.00",
      "2026-10-02,Refund,3.50",
    ].join("\r\n");

    expect(parseBankCsv(csv)).toEqual({
      ok: true,
      expenses: [{ date: "2026-10-01", amount: 1_400, note: "Coffee" }],
      skipped: { income: 1, foreignCurrency: 0, invalid: 0 },
    });
  });

  it("tabulatory, minus typograficzny i twarde spacje w kwocie", () => {
    const csv = ["Data\tOpis\tKwota", "05/10/2026\tKino\t−1 050,5"].join("\n");

    expect(parseBankCsv(csv)).toMatchObject({
      expenses: [{ date: "2026-10-05", amount: 105_050, note: "Kino" }],
    });
  });

  it("zła data, pusta albo zerowa kwota, za dużo miejsc po przecinku → pominięte jako błędne", () => {
    const csv = [
      "Data;Opis;Kwota",
      "31.02.2026;Nie ma takiego dnia;-10,00",
      "2026-10-01;Pusto;",
      "2026-10-01;Zero;0,00",
      "2026-10-01;Ułamek grosza;-1,005",
      "2026-10-01;Tekst;abc",
      "wczoraj;Data słowami;-1,00",
      "2026-10-03",
      "2026-10-02;Dobry;-1,5",
    ].join("\n");

    expect(parseBankCsv(csv)).toEqual({
      ok: true,
      expenses: [{ date: "2026-10-02", amount: 150, note: "Dobry" }],
      skipped: { income: 0, foreignCurrency: 0, invalid: 7 },
    });
  });

  it("rok przestępny: 29.02.2028 jest poprawną datą, 29.02.2027 nie", () => {
    const csv = ["Data;Opis;Kwota", "29.02.2028;A;-1,00", "29.02.2027;B;-1,00"].join("\n");

    expect(parseBankCsv(csv)).toMatchObject({
      expenses: [{ date: "2028-02-29" }],
      skipped: { invalid: 1 },
    });
  });

  it("tylko „Data księgowania”: też data; pusta waluta w kolumnie = PLN; EUR w polu kwoty = obca", () => {
    const csv = [
      "Data księgowania;Opis;Kwota;Waluta",
      "2026-10-01;Chleb;-5,00;",
      "2026-10-02;Kawa w Wiedniu;-4,00 EUR;",
    ].join("\n");

    expect(parseBankCsv(csv)).toEqual({
      ok: true,
      expenses: [{ date: "2026-10-01", amount: 500, note: "Chleb" }],
      skipped: { income: 0, foreignCurrency: 1, invalid: 0 },
    });
  });

  it("bez opisu: notatka pusta (null)", () => {
    expect(parseBankCsv("Data;Kwota\n2026-10-01;-3,00")).toMatchObject({
      expenses: [{ date: "2026-10-01", amount: 300, note: null }],
    });
  });

  it("długi opis przycięty do 500 znaków (limit notatki)", () => {
    const long = "x".repeat(600);
    const result = parseBankCsv(`Data;Opis;Kwota\n2026-10-01;${long};-3,00`);

    expect(result.ok && result.expenses[0]?.note?.length).toBe(500);
  });

  it("cudzysłowy w polu: podwojony cudzysłów i średnik w środku", () => {
    const csv = 'Data;Opis;Kwota\n2026-10-01;"Sklep ""Pod Lipą""; Kraków";-9,99';

    expect(parseBankCsv(csv)).toMatchObject({
      expenses: [{ note: 'Sklep "Pod Lipą"; Kraków' }],
    });
  });

  it("nie ma kolumny daty albo kwoty → błąd z powodem", () => {
    expect(parseBankCsv("Nazwa;Wartość\nA;1")).toEqual({ ok: false, reason: "no-columns" });
  });

  it("pusty plik → błąd", () => {
    expect(parseBankCsv("")).toEqual({ ok: false, reason: "no-columns" });
    expect(parseBankCsv("\n\n")).toEqual({ ok: false, reason: "no-columns" });
  });

  it("nagłówek jest, ale nie ma żadnych wierszy → zero wydatków (to nie błąd pliku)", () => {
    expect(parseBankCsv("Data;Opis;Kwota\n")).toEqual({
      ok: true,
      expenses: [],
      skipped: { income: 0, foreignCurrency: 0, invalid: 0 },
    });
  });
});

describe("decodeBankFile", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);

  it("UTF-8 (z BOM i bez)", () => {
    const utf8 = new TextEncoder().encode("Żółć;-1,00");
    expect(decodeBankFile(utf8)).toBe("Żółć;-1,00");
    expect(decodeBankFile(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe("Żółć;-1,00");
  });

  it("Windows-1250 (eksport mBanku i starszych systemów): polskie znaki", () => {
    // „Żółć ąęśńŁ” w Windows-1250.
    expect(decodeBankFile(bytes(0xaf, 0xf3, 0xb3, 0xe6, 0x20, 0xb9, 0xea, 0x9c, 0xf1, 0xa3))).toBe(
      "Żółć ąęśńŁ",
    );
  });

  it("UTF-8 z 3- i 4-bajtowymi znakami (€, emoji)", () => {
    const text = "€ 😀 ok";
    expect(decodeBankFile(new TextEncoder().encode(text))).toBe(text);
  });

  it("ucięta albo zła sekwencja UTF-8 → Windows-1250", () => {
    // C5 na końcu (brak drugiego bajtu) i C5 41 (zła kontynuacja): w 1250 to „Ĺ”.
    expect(decodeBankFile(bytes(0x41, 0xc5))).toBe("AĹ");
    expect(decodeBankFile(bytes(0xc5, 0x41))).toBe("ĹA");
    // F5 nigdy nie zaczyna znaku UTF-8; w 1250 to „ő”.
    expect(decodeBankFile(bytes(0xf5))).toBe("ő");
  });

  it("czysty ASCII to ten sam tekst w obu kodowaniach", () => {
    expect(decodeBankFile(bytes(0x41, 0x3b, 0x31))).toBe("A;1");
  });
});
