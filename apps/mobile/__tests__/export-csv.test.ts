import type { ExportData } from "@vireo/shared";

import { buildExportFile } from "../src/export/csv-files";
import {
  billsCategory,
  testCategory,
  testGoal,
  testIncomeSource,
  testRule,
  testTransaction,
} from "./helpers/fake-api";

/** Each file is a CSV for a Polish spreadsheet: BOM, ";" and CRLF. */
const csv = (...lines: string[]) => `\uFEFF${lines.map((line) => `${line}\r\n`).join("")}`;

const rent = testRule({ name: "Czynsz" });
const netflix = testRule({
  id: "01923b6e-0000-7000-8000-000000000047",
  name: "Netflix",
  dayOfMonth: 12,
  expectedAmount: 4_999,
  categoryId: testCategory.id,
  isSubscription: true,
  isActive: false,
});

const data: ExportData = {
  exportedOn: "2026-10-20",
  categories: [testCategory, billsCategory],
  expenses: [
    { ...testTransaction({ note: "Obiad; z deserem" }), occurrenceDate: null },
    {
      ...testTransaction({
        id: "01923b6e-0000-7000-8000-000000000031",
        amount: 150_000,
        date: "2026-10-05",
        categoryId: billsCategory.id,
        recurringRuleId: rent.id,
        status: "PENDING",
      }),
      occurrenceDate: "2026-10-05",
    },
    {
      ...testTransaction({
        id: "01923b6e-0000-7000-8000-000000000032",
        amount: 30_000,
        categoryId: null,
        note: "Wydatki przed Finso",
        beforeFinso: true,
      }),
      occurrenceDate: null,
    },
  ],
  incomeSources: [testIncomeSource()],
  incomeEntries: [
    {
      id: "01923b6e-0000-7000-8000-000000000051",
      incomeSourceId: testIncomeSource().id,
      amount: 500_000,
      date: "2026-10-10",
      status: "CONFIRMED",
      occurrenceDate: "2026-10-10",
    },
  ],
  goals: [testGoal()],
  recurringRules: [rent, netflix, testRule({ id: "x", kind: "INCOME", name: null })],
};

describe("export files", () => {
  it("expenses: exact amounts, category, note, status, commitment and its due date", () => {
    expect(buildExportFile(data, "expenses")).toEqual({
      fileName: "finso-wydatki-2026-10-20.csv",
      csv: csv(
        "Data;Kwota (zł);Kategoria;Notatka;Status;Stała płatność;Termin płatności;Wydatki przed Finso",
        '2026-09-27;45,90;Jedzenie;"Obiad; z deserem";Zapłacone;;;',
        "2026-10-05;1500,00;Rachunki;;Jeszcze nie;Czynsz;2026-10-05;",
        "2026-09-27;300,00;;Wydatki przed Finso;Zapłacone;;;tak",
      ),
    });
  });

  it("income: amount, source, status and due date", () => {
    expect(buildExportFile(data, "income")).toEqual({
      fileName: "finso-wplywy-2026-10-20.csv",
      csv: csv(
        "Data;Kwota (zł);Źródło;Status;Termin wpływu",
        "2026-10-10;5000,00;Wypłata;Wpłynęło;2026-10-10",
      ),
    });
  });

  it("goals: target, saved so far and deadline", () => {
    expect(buildExportFile(data, "goals")).toEqual({
      fileName: "finso-cele-2026-10-20.csv",
      csv: csv(
        "Nazwa;Kwota docelowa (zł);Odłożone (zł);Termin",
        "Wakacje;4000,00;1000,00;2027-06-01",
      ),
    });
  });

  it("commitments: expense rules only, with rhythm, start, category and flags", () => {
    expect(buildExportFile(data, "commitments")).toEqual({
      fileName: "finso-stale-zobowiazania-2026-10-20.csv",
      csv: csv(
        "Nazwa;Kwota (zł);Jak często;Od;Kategoria;Aktywne;Subskrypcja",
        "Czynsz;1500,00;co miesiąc, 5. dnia;2026-09-10;Rachunki;tak;nie",
        "Netflix;49,99;co miesiąc, 12. dnia;2026-09-10;Jedzenie;nie;tak",
      ),
    });
  });

  it("an empty list is a file with the header only", () => {
    expect(buildExportFile({ ...data, goals: [] }, "goals").csv).toBe(
      csv("Nazwa;Kwota docelowa (zł);Odłożone (zł);Termin"),
    );
  });
});
