/**
 * Polish UI copy. Kept in one module so other languages can be added later
 * without hunting for strings in components.
 */
export const pl = {
  meta: {
    title: "Finso",
    description: "Sprawdź, czy stać cię na to teraz — zanim wydasz pieniądze.",
  },
  preview: {
    eyebrow: "Design system Vireo · podgląd",
    heading: "Finso",
    availableLabel: "Możesz dziś wydać",
    // Static sample until the money formatter lands with the dashboard.
    availableSample: "86,40 zł",
    availableHint: "Przykładowa kwota",
    statusLabel: "Poziomy „czy mnie stać”",
    safe: "Stać cię",
    caution: "Na styk",
    risk: "Nie stać",
    actionsLabel: "Przyciski",
    addExpense: "Dodaj wydatek",
    simulate: "Symuluj",
    cancel: "Anuluj",
    deleteAccount: "Usuń konto",
  },
} as const;
