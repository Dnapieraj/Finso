import { grosze, type Grosze } from "@vireo/shared";

/**
 * A sentence with amounts in it. Amounts stay in grosze and are rendered
 * by the `Money` component, so copy never hard-codes a formatted price.
 */
export type RichText = readonly (
  string | { readonly amount: Grosze; readonly whole?: "down" | "up"; readonly sign?: "always" }
)[];

/**
 * Polish UI copy. Kept in one module so other languages can be added later
 * without hunting for strings in components.
 */
export const pl = {
  meta: {
    title: "Finso — czy stać cię na to teraz?",
    description:
      "Finso odpowiada na pytanie „czy stać mnie na to teraz” — zanim wydasz pieniądze, nie po fakcie. Aplikacja na iOS i Androida.",
  },
  header: {
    skipToContent: "Przejdź do treści",
    homeLabel: "Finso — strona główna",
    navLabel: "Sekcje strony",
    nav: {
      features: "Wyróżniki",
      howItWorks: "Jak to działa",
      pricing: "Cennik",
    },
  },
  stores: {
    appStorePrefix: "Pobierz z",
    appStore: "App Store",
    googlePlayPrefix: "Pobierz z",
    googlePlay: "Google Play",
  },
  hero: {
    eyebrow: "Aplikacja na iOS i Androida",
    title: "Czy stać cię na to teraz?",
    lead: "Finso odpowiada na to pytanie, zanim wydasz pieniądze — nie po fakcie. Wpisz kwotę przed zakupem, a w sekundę zobaczysz, ile ci zostanie i co to zmieni w twoich celach.",
    storesLabel: "Pobierz aplikację",
    mockup: {
      caption: "Przykładowy ekran symulatora. Kwoty są poglądowe.",
      screenTitle: "Czy mnie stać?",
      itemLabel: "Słuchawki",
      itemPrice: grosze(34900),
      verdict: "Stać cię",
      remainingLabel: "Zostanie ci",
      remaining: grosze(120960),
      remainingSuffix: "na 12 dni",
      dailyLabel: "Dziennie",
      daily: grosze(10080),
      goalLabel: "Cel „Wakacje”",
      goalImpact: "bez opóźnienia",
    },
  },
  features: {
    title: "Nie wykresy z przeszłości. Odpowiedź na teraz.",
    lead: "Inne aplikacje pokazują, na co poszły pieniądze. Finso pomaga zdecydować, zanim wydasz.",
    items: [
      {
        key: "simulator",
        title: "Symulator decyzji",
        body: "Wpisz kwotę i kategorię przed zakupem. Finso powie, ile zostanie do wypłaty, ile wypada dziennie i czy któryś cel oszczędnościowy się przesunie.",
        example: ["„Tak — zostanie ci ", { amount: grosze(34000), whole: "down" }, " na 12 dni”"],
      },
      {
        key: "irregular",
        title: "Nieregularne dochody",
        body: "Zlecenia, napiwki, korepetycje? Finso uczy się twojego średniego dochodu i jego wahań, a budżet liczy z ostrożnej prognozy z buforem, nie ze stałej pensji.",
        example: [
          "„Ostrożna prognoza na ten miesiąc: ",
          { amount: grosze(320000), whole: "down" },
          "”",
        ],
      },
      {
        key: "subscriptions",
        title: "Detektor subskrypcji",
        body: "Wykrywa powtarzające się płatności, podwyżki cen i subskrypcje, z których już nie korzystasz — zanim zapłacisz za nie kolejny rok.",
        example: [
          "„Spotify podrożał o ",
          { amount: grosze(400), whole: "up" },
          " — to ",
          { amount: grosze(4800), whole: "up" },
          " rocznie”",
        ],
      },
      {
        key: "shared",
        title: "Wspólne wydatki",
        body: "Dzielisz rachunek ze znajomymi? Kwota do odzyskania jest widoczna w budżecie jako należność w drodze, a nie pieniądze, które zniknęły.",
        example: [
          "„Należność w drodze: ",
          { amount: grosze(20000), whole: "down", sign: "always" },
          " od Oli”",
        ],
      },
    ],
  },
  howItWorks: {
    title: "Jak to działa",
    lead: "Kilka minut konfiguracji, potem sekundy przy każdym zakupie.",
    steps: [
      {
        title: "Pobierz aplikację",
        body: "Załóż konto w Finso na iPhonie lub telefonie z Androidem.",
      },
      {
        title: "Dodaj dochody i stałe opłaty",
        body: "Regularna pensja albo nieregularne wpływy, czynsz, rachunki i subskrypcje. Wystarczy raz.",
      },
      {
        title: "Przed zakupem wpisz kwotę",
        body: "Stoisz przy kasie albo w koszyku sklepu internetowego? Wpisz, ile chcesz wydać.",
      },
      {
        title: "Decyduj z pełnym obrazem",
        body: "Widzisz, ile zostanie do wypłaty, ile dziennie i jak zakup wpłynie na twoje cele.",
      },
    ],
  },
  pricing: {
    title: "Cennik",
    lead: "Zacznij za darmo. Plus odblokujesz w aplikacji, gdy będzie ci potrzebny.",
    perMonth: "/ mies.",
    free: {
      name: "Free",
      priceNote: "na zawsze",
      features: [
        "Ręczne wydatki bez limitu",
        "1 cel oszczędnościowy",
        "Historia z 60 dni",
        "Symulator „czy mnie stać” — 5 razy dziennie",
      ],
    },
    plus: {
      name: "Plus",
      badge: "Pełnia możliwości",
      yearlyPrefix: "lub",
      yearlyMiddle: "rocznie — wychodzi",
      yearlySuffix: "miesięcznie",
      features: [
        "Nielimitowane cele i symulacje",
        "Detektor subskrypcji i podwyżek",
        "Prognozy dla nieregularnych dochodów",
        "Wspólne wydatki",
        "Pełna historia i eksport danych",
        "Widżety na ekranie głównym",
      ],
    },
    storeNote:
      "Subskrypcję Plus kupisz wyłącznie w aplikacji — płatność obsługuje App Store lub Google Play. Anulujesz ją w każdej chwili w ustawieniach sklepu.",
    storesLabel: "Pobierz Finso",
  },
  footer: {
    tagline: "Finso to produkt marki Vireo.",
    legalLabel: "Informacje prawne",
    privacy: "Polityka prywatności",
    terms: "Regulamin",
    deleteAccount: "Usuwanie konta",
    copyright: "© 2026 Vireo",
  },
} as const;
