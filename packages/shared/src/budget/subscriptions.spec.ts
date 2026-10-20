import { describe, expect, it } from "vitest";

import { isoDate } from "../date.js";
import { grosze } from "../money.js";
import type {
  SubscriptionExpense,
  SubscriptionRule,
  SubscriptionsOverviewInput,
} from "./subscriptions.js";
import {
  detectPriceChange,
  isSamePrice,
  normalizeSubscriptionName,
  subscriptionCost,
  subscriptionsOverview,
} from "./subscriptions.js";

/**
 * Detektor subskrypcji (PRODUCT.md, Faza 1, punkt 12; plan, punkt 7).
 *
 * Seria płatności to subskrypcja, gdy ma tę samą nazwę (notatkę po
 * normalizacji) i kategorię, podobną kwotę i regularny odstęp:
 * - co tydzień: odstęp 5–9 dni, średnio 6–8, co najmniej 4 płatności;
 * - co miesiąc: 22–38 dni, średnio 26–34, co najmniej 3 płatności;
 * - co rok: 350–380 dni, co najmniej 2 płatności (tylko z notatką).
 * Jeden brakujący wpis (podwójny odstęp) jest dozwolony. Wydatki bez
 * notatki: ta sama kategoria i dokładnie ta sama kwota, tylko co miesiąc.
 */

const d = isoDate;
const g = grosze;

const SUB = "cat-subscriptions";
const FOOD = "cat-food";

function expense(
  date: string,
  amount: number,
  note: string | null,
  overrides: Partial<SubscriptionExpense> = {},
): SubscriptionExpense {
  return {
    date: d(date),
    amount: g(amount),
    note,
    categoryId: SUB,
    status: "CONFIRMED",
    recurringRuleId: null,
    beforeFinso: false,
    ...overrides,
  };
}

function rule(overrides: Partial<SubscriptionRule> = {}): SubscriptionRule {
  return {
    id: "rule-1",
    name: "Czynsz",
    frequency: "MONTHLY",
    interval: 1,
    expectedAmount: g(150_000),
    categoryId: "cat-home",
    isSubscription: false,
    payments: [],
    ...overrides,
  };
}

function overview(input: Partial<SubscriptionsOverviewInput>) {
  return subscriptionsOverview({
    asOf: d("2026-10-20"),
    expenses: [],
    rules: [],
    dismissedKeys: [],
    ...input,
  });
}

/** Spotify 10. każdego miesiąca, 23 zł — sierpień, wrzesień, październik. */
const spotify = [
  expense("2026-08-10", 2_300, "Spotify"),
  expense("2026-09-10", 2_300, "Spotify"),
  expense("2026-10-10", 2_300, "Spotify"),
];

describe("normalizeSubscriptionName", () => {
  it.each([
    ["Spotify", "spotify"],
    ["  SPOTIFY  premium ", "spotify premium"],
    ["Spotify 03/2026", "spotify"],
    ["Łódź-Kino!!", "lodz kino"],
    ["Żabka, faktura nr FV12", "zabka faktura nr"],
  ])("%s → %s", (note, expected) => {
    expect(normalizeSubscriptionName(note)).toBe(expected);
  });

  it.each([[null], [""], ["   "], ["2026"], ["03/2026 #12"]])(
    "%s → null (wydatek bez nazwy)",
    (note) => {
      expect(normalizeSubscriptionName(note)).toBeNull();
    },
  );
});

describe("isSamePrice", () => {
  it.each([
    [2_399, 2_401, true],
    [2_300, 2_700, false],
    // Przy małych kwotach tolerancja to 50 gr (5% z 5 zł to tylko 25 gr).
    [500, 550, true],
    [500, 551, false],
    // Przy większych — 5%.
    [10_000, 10_500, true],
    [10_000, 10_501, false],
    [10_500, 10_000, true],
  ])("%i i %i → %s", (a, b, same) => {
    expect(isSamePrice(g(a), g(b))).toBe(same);
  });
});

describe("subscriptionCost", () => {
  it("co miesiąc: ×12 rocznie", () => {
    expect(subscriptionCost(g(2_700), "MONTHLY")).toEqual({ monthly: 2_700, yearly: 32_400 });
  });

  it("co tydzień: ×52 rocznie, miesięcznie zaokrąglone w górę (koszt)", () => {
    // 520 zł / 12 = 43,333… zł → 43,34 zł.
    expect(subscriptionCost(g(1_000), "WEEKLY")).toEqual({ monthly: 4_334, yearly: 52_000 });
  });

  it("co rok: miesięcznie to 1/12, w górę", () => {
    expect(subscriptionCost(g(9_900), "YEARLY")).toEqual({ monthly: 825, yearly: 9_900 });
    expect(subscriptionCost(g(10_000), "YEARLY")).toEqual({ monthly: 834, yearly: 10_000 });
  });

  it("uwzględnia interwał: co 2 tygodnie to 26 płatności w roku", () => {
    expect(subscriptionCost(g(1_000), "WEEKLY", 2).yearly).toBe(26_000);
  });

  it("interwał, który nie dzieli roku równo — rocznie w górę", () => {
    // Co 7 miesięcy: 12/7 płatności rocznie → 1714,28… zł → 1714,29 zł.
    expect(subscriptionCost(g(100_000), "MONTHLY", 7).yearly).toBe(171_429);
  });
});

describe("detectPriceChange", () => {
  const payments = (amounts: number[]) =>
    amounts.map((amount, i) => ({
      date: d(`2026-0${String(i + 1)}-10`),
      amount: g(amount),
    }));

  it("podwyżka 23 → 27 zł: +48 zł rocznie, od pierwszej płatności w nowej cenie", () => {
    expect(detectPriceChange(payments([2_300, 2_300, 2_700, 2_700]), "MONTHLY")).toEqual({
      from: 2_300,
      to: 2_700,
      since: "2026-03-10",
      yearlyDelta: 4_800,
    });
  });

  it("obniżka: ujemna różnica roczna", () => {
    expect(detectPriceChange(payments([4_300, 4_300, 3_900]), "MONTHLY")).toEqual({
      from: 4_300,
      to: 3_900,
      since: "2026-03-10",
      yearlyDelta: -4_800,
    });
  });

  it("różnice o grosze to nie zmiana ceny", () => {
    expect(detectPriceChange(payments([2_399, 2_401, 2_397, 2_402]), "MONTHLY")).toBeNull();
  });

  it("jednorazowo inna kwota między dwiema takimi samymi to nie zmiana ceny", () => {
    expect(detectPriceChange(payments([4_300, 6_000, 4_300]), "MONTHLY")).toBeNull();
  });

  it("dwie zmiany: pokazuje ostatnią", () => {
    expect(detectPriceChange(payments([2_300, 2_500, 2_500, 2_700]), "MONTHLY")).toMatchObject({
      from: 2_500,
      to: 2_700,
      since: "2026-04-10",
    });
  });

  it("kolejność wejścia nie ma znaczenia", () => {
    const shuffled = payments([2_300, 2_300, 2_700]).reverse();
    expect(detectPriceChange(shuffled, "MONTHLY")).toMatchObject({ from: 2_300, to: 2_700 });
  });

  it("za mało płatności → brak zmiany", () => {
    expect(detectPriceChange([], "MONTHLY")).toBeNull();
    expect(detectPriceChange(payments([2_300]), "MONTHLY")).toBeNull();
  });
});

describe("subscriptionsOverview — wykrywanie", () => {
  it("trzy płatności co miesiąc → wykryta subskrypcja z najbliższym terminem", () => {
    const { detected } = overview({ expenses: spotify });

    expect(detected).toEqual([
      {
        key: "n|cat-subscriptions|spotify",
        name: "Spotify",
        categoryId: SUB,
        frequency: "MONTHLY",
        amount: 2_300,
        monthly: 2_300,
        yearly: 27_600,
        paymentsCount: 3,
        lastDate: "2026-10-10",
        nextDate: "2026-11-10",
        priceChange: null,
        schedule: {
          frequency: "MONTHLY",
          interval: 1,
          startDate: "2026-11-10",
          dayOfMonth: 10,
          dayOfWeek: null,
        },
      },
    ]);
  });

  it("nazwa do wyświetlenia z ostatniej płatności, grupowanie po znormalizowanej", () => {
    const { detected } = overview({
      expenses: [
        expense("2026-08-10", 2_300, "spotify"),
        expense("2026-09-10", 2_300, "SPOTIFY 09/2026"),
        expense("2026-10-10", 2_300, " Spotify "),
      ],
    });

    expect(detected).toHaveLength(1);
    expect(detected[0]?.name).toBe("Spotify");
  });

  it("kwota zmienia się o grosze (płatność w obcej walucie) → jedna subskrypcja bez podwyżki", () => {
    const { detected } = overview({
      expenses: [
        expense("2026-08-10", 2_399, "Netflix"),
        expense("2026-09-10", 2_401, "Netflix"),
        expense("2026-10-10", 2_397, "Netflix"),
      ],
    });

    expect(detected).toHaveLength(1);
    expect(detected[0]).toMatchObject({ amount: 2_397, priceChange: null, paymentsCount: 3 });
  });

  it("dzień przesuwa się o kilka dni (10., 13., 8.) → nadal co miesiąc, termin od mediany dnia", () => {
    const { detected } = overview({
      expenses: [
        expense("2026-08-10", 2_300, "Spotify"),
        expense("2026-09-13", 2_300, "Spotify"),
        expense("2026-10-08", 2_300, "Spotify"),
      ],
    });

    expect(detected[0]).toMatchObject({ frequency: "MONTHLY", nextDate: "2026-11-10" });
  });

  it("kotwica 31. przez luty → co miesiąc, termin w krótszym miesiącu na ostatni dzień", () => {
    const { detected } = overview({
      asOf: d("2026-04-05"),
      expenses: [
        expense("2026-01-31", 4_900, "Siłownia"),
        expense("2026-02-28", 4_900, "Siłownia"),
        expense("2026-03-31", 4_900, "Siłownia"),
      ],
    });

    expect(detected[0]).toMatchObject({ nextDate: "2026-04-30" });
    expect(detected[0]?.schedule).toMatchObject({ dayOfMonth: 31 });
  });

  it("opłata roczna: dwie płatności co rok wystarczą", () => {
    const { detected } = overview({
      expenses: [expense("2025-03-05", 9_900, "Domena"), expense("2026-03-07", 9_900, "Domena")],
    });

    expect(detected).toEqual([
      expect.objectContaining({
        frequency: "YEARLY",
        amount: 9_900,
        monthly: 825,
        yearly: 9_900,
        nextDate: "2027-03-07",
      }),
    ]);
  });

  it("roczna z 29 lutego → kolejny termin 28 lutego, kotwica zostaje 29", () => {
    const { detected } = overview({
      asOf: d("2025-06-01"),
      expenses: [
        expense("2024-02-29", 19_900, "Antywirus"),
        expense("2025-02-28", 19_900, "Antywirus"),
      ],
    });

    expect(detected[0]).toMatchObject({ frequency: "YEARLY", nextDate: "2026-02-28" });
    expect(detected[0]?.schedule).toMatchObject({ dayOfMonth: 29, startDate: "2026-02-28" });
  });

  it("co tydzień: cztery płatności, także przez zmianę czasu (25.10)", () => {
    const { detected } = overview({
      asOf: d("2026-11-04"),
      expenses: [
        expense("2026-10-13", 1_500, "Basen"),
        expense("2026-10-20", 1_500, "Basen"),
        expense("2026-10-27", 1_500, "Basen"),
        expense("2026-11-03", 1_500, "Basen"),
      ],
    });

    expect(detected[0]).toMatchObject({
      frequency: "WEEKLY",
      nextDate: "2026-11-10",
      monthly: 6_500,
      yearly: 78_000,
      schedule: { frequency: "WEEKLY", dayOfWeek: 2, dayOfMonth: null, startDate: "2026-11-10" },
    });
  });

  describe("za mało historii → nic", () => {
    it.each([
      ["pusta historia", []],
      ["dwie płatności co miesiąc", spotify.slice(1)],
      [
        "trzy płatności co tydzień",
        [
          expense("2026-10-06", 1_500, "Basen"),
          expense("2026-10-13", 1_500, "Basen"),
          expense("2026-10-20", 1_500, "Basen"),
        ],
      ],
      ["jedna płatność roczna", [expense("2026-03-07", 9_900, "Domena")]],
    ])("%s", (_case, expenses) => {
      expect(overview({ expenses }).detected).toEqual([]);
    });
  });

  it("jeden brakujący wpis (podwójny odstęp) jest dozwolony", () => {
    const { detected } = overview({
      expenses: [
        expense("2026-06-10", 2_300, "Spotify"),
        expense("2026-07-10", 2_300, "Spotify"),
        expense("2026-09-10", 2_300, "Spotify"),
        expense("2026-10-10", 2_300, "Spotify"),
      ],
    });

    expect(detected[0]).toMatchObject({ paymentsCount: 4 });
  });

  it("dwa brakujące wpisy → seria przerwana, za krótka", () => {
    const { detected } = overview({
      expenses: [
        expense("2026-06-10", 2_300, "Spotify"),
        expense("2026-08-10", 2_300, "Spotify"),
        expense("2026-10-10", 2_300, "Spotify"),
      ],
    });

    expect(detected).toEqual([]);
  });

  it("starsza nieregularna płatność nie psuje serii — liczy się tylko regularna końcówka", () => {
    const { detected } = overview({
      expenses: [expense("2026-02-14", 2_300, "Spotify"), ...spotify],
    });

    expect(detected[0]).toMatchObject({ paymentsCount: 3 });
  });

  it("odstępy regularne, ale średnio za krótkie (co 23 dni) → nie co miesiąc", () => {
    const { detected } = overview({
      expenses: [
        expense("2026-09-04", 5_000, "Fryzjer"),
        expense("2026-09-27", 5_000, "Fryzjer"),
        expense("2026-10-20", 5_000, "Fryzjer"),
      ],
    });

    expect(detected).toEqual([]);
  });

  it("ostatnia płatność dawno (46 dni przy co miesiąc) → prawdopodobnie anulowana", () => {
    const expenses = [
      expense("2026-07-05", 2_300, "Spotify"),
      expense("2026-08-05", 2_300, "Spotify"),
      expense("2026-09-04", 2_300, "Spotify"),
    ];

    expect(overview({ asOf: d("2026-10-19"), expenses }).detected).toHaveLength(1);
    expect(overview({ asOf: d("2026-10-20"), expenses }).detected).toEqual([]);
  });

  it("losowe kwoty co miesiąc (zakupy w tym samym sklepie) → nie subskrypcja", () => {
    const { detected } = overview({
      expenses: [
        expense("2026-07-10", 5_000, "Biedronka", { categoryId: FOOD }),
        expense("2026-08-10", 12_000, "Biedronka", { categoryId: FOOD }),
        expense("2026-09-10", 8_000, "Biedronka", { categoryId: FOOD }),
        expense("2026-10-10", 15_000, "Biedronka", { categoryId: FOOD }),
      ],
    });

    expect(detected).toEqual([]);
  });

  it("dwie subskrypcje pod jedną nazwą (różne kwoty, różne dni) → dwie pozycje", () => {
    const { detected } = overview({
      expenses: [
        expense("2026-08-01", 499, "Apple"),
        expense("2026-08-15", 2_999, "Apple"),
        expense("2026-09-01", 499, "Apple"),
        expense("2026-09-15", 2_999, "Apple"),
        expense("2026-10-01", 499, "Apple"),
        expense("2026-10-15", 2_999, "Apple"),
      ],
    });

    expect(detected.map((item) => [item.key, item.amount])).toEqual([
      ["n|cat-subscriptions|apple|2999", 2_999],
      ["n|cat-subscriptions|apple|499", 499],
    ]);
  });

  it("ta sama nazwa w różnych kategoriach to różne grupy", () => {
    const { detected } = overview({
      expenses: [
        expense("2026-08-10", 2_300, "Spotify"),
        expense("2026-09-10", 2_300, "Spotify", { categoryId: FOOD }),
        expense("2026-10-10", 2_300, "Spotify"),
      ],
    });

    expect(detected).toEqual([]);
  });

  it("pomija: niepotwierdzone, odrzucone, z reguły, „przed Finso” i daty z przyszłości", () => {
    const { detected } = overview({
      expenses: [
        expense("2026-08-10", 2_300, "Spotify"),
        expense("2026-09-10", 2_300, "Spotify"),
        expense("2026-10-10", 2_300, "Spotify", { status: "PENDING" }),
        expense("2026-10-11", 2_300, "Spotify", { status: "DECLINED" }),
        expense("2026-10-12", 2_300, "Spotify", { recurringRuleId: "rule-x" }),
        expense("2026-10-13", 2_300, "Spotify", { beforeFinso: true }),
        expense("2026-11-10", 2_300, "Spotify"),
      ],
    });

    expect(detected).toEqual([]);
  });

  it("kolejność wejścia nie ma znaczenia", () => {
    expect(overview({ expenses: [...spotify].reverse() }).detected).toHaveLength(1);
  });

  it("sortuje od najdroższej miesięcznie", () => {
    const netflix = spotify.map((item) => ({ ...item, note: "Netflix", amount: g(4_900) }));
    const { detected } = overview({ expenses: [...spotify, ...netflix] });

    expect(detected.map((item) => item.name)).toEqual(["Netflix", "Spotify"]);
  });

  it("przy równym koszcie — alfabetycznie po kluczu", () => {
    const tidal = spotify.map((item) => ({ ...item, note: "Tidal" }));
    const { detected } = overview({ expenses: [...tidal, ...spotify] });

    expect(detected.map((item) => item.name)).toEqual(["Spotify", "Tidal"]);
  });

  describe("podwyżka ceny", () => {
    it("Spotify 23 → 27 zł od października: +48 zł rocznie", () => {
      const { detected } = overview({
        expenses: [
          expense("2026-07-10", 2_300, "Spotify"),
          expense("2026-08-10", 2_300, "Spotify"),
          expense("2026-09-10", 2_300, "Spotify"),
          expense("2026-10-10", 2_700, "Spotify"),
        ],
      });

      expect(detected[0]).toMatchObject({
        amount: 2_700,
        monthly: 2_700,
        paymentsCount: 4,
        priceChange: { from: 2_300, to: 2_700, since: "2026-10-10", yearlyDelta: 4_800 },
      });
    });

    it("jednorazowo inna kwota w środku nie przerywa serii ani nie jest podwyżką", () => {
      const { detected } = overview({
        expenses: [
          expense("2026-07-10", 4_300, "Netflix"),
          expense("2026-08-10", 6_000, "Netflix"),
          expense("2026-09-10", 4_300, "Netflix"),
          expense("2026-10-10", 4_300, "Netflix"),
        ],
      });

      expect(detected[0]).toMatchObject({ paymentsCount: 4, priceChange: null });
    });

    it("dwie zmiany ceny: liczy się seria od przedostatniej ceny", () => {
      const { detected } = overview({
        expenses: [
          expense("2026-05-10", 2_100, "Spotify"),
          expense("2026-06-10", 2_300, "Spotify"),
          expense("2026-07-10", 2_300, "Spotify"),
          expense("2026-08-10", 2_300, "Spotify"),
          expense("2026-09-10", 2_700, "Spotify"),
          expense("2026-10-10", 2_700, "Spotify"),
        ],
      });

      expect(detected[0]).toMatchObject({
        paymentsCount: 5,
        priceChange: { from: 2_300, to: 2_700, since: "2026-09-10" },
      });
    });
  });

  describe("wydatki bez notatki", () => {
    const noteless = (amount = 3_999, categoryId = SUB) =>
      ["2026-08-12", "2026-09-12", "2026-10-12"].map((date) =>
        expense(date, amount, null, { categoryId }),
      );

    it("ta sama kategoria i dokładnie ta sama kwota co miesiąc → wykryte bez nazwy", () => {
      const { detected } = overview({ expenses: noteless() });

      expect(detected).toEqual([
        expect.objectContaining({
          key: "a|cat-subscriptions|3999",
          name: null,
          categoryId: SUB,
          frequency: "MONTHLY",
        }),
      ]);
    });

    it("bez kategorii też, z pustą kategorią w kluczu", () => {
      const expenses = noteless().map((item) => ({ ...item, categoryId: null }));

      expect(overview({ expenses }).detected[0]).toMatchObject({
        key: "a||3999",
        categoryId: null,
      });
    });

    it("kwota różna choćby o grosz → osobne grupy, nic nie wykryte", () => {
      const expenses = noteless().map((item) =>
        item.date === d("2026-09-12") ? { ...item, amount: g(4_000) } : item,
      );

      expect(overview({ expenses }).detected).toEqual([]);
    });

    it("tylko co miesiąc — co tydzień i co rok bez nazwy to zbyt słaby sygnał", () => {
      const weekly = ["2026-09-29", "2026-10-06", "2026-10-13", "2026-10-20"].map((date) =>
        expense(date, 1_500, null),
      );
      const yearly = [expense("2025-03-05", 9_900, null), expense("2026-03-07", 9_900, null)];

      expect(overview({ expenses: weekly }).detected).toEqual([]);
      expect(overview({ expenses: yearly }).detected).toEqual([]);
    });
  });

  describe("zbieg z istniejącą stałą płatnością → nie dublować", () => {
    it("reguła o tej samej nazwie (po normalizacji), nawet w innej kategorii", () => {
      const rules = [
        rule({
          name: "SPOTIFY!",
          categoryId: FOOD,
          expectedAmount: g(2_300),
          isSubscription: true,
        }),
      ];

      expect(overview({ expenses: spotify, rules }).detected).toEqual([]);
    });

    it("reguła z tą samą kategorią, cyklem i kwotą (w tolerancji), inna nazwa", () => {
      const rules = [rule({ name: "Muzyka", categoryId: SUB, expectedAmount: g(2_350) })];

      expect(overview({ expenses: spotify, rules }).detected).toEqual([]);
    });

    it("wydatki bez notatki pasujące do reguły kategorią, cyklem i kwotą", () => {
      const expenses = ["2026-08-04", "2026-09-04", "2026-10-04"].map((date) =>
        expense(date, 150_000, null, { categoryId: "cat-home" }),
      );

      expect(overview({ expenses, rules: [rule()] }).detected).toEqual([]);
    });

    it.each([
      ["inny cykl", { frequency: "YEARLY" as const }],
      ["inny interwał", { interval: 2 }],
      ["inna kwota", { expectedAmount: g(3_000) }],
      ["inna kategoria", { categoryId: FOOD }],
    ])("reguła o innej nazwie i: %s → nie blokuje", (_case, change) => {
      const rules = [
        rule({ name: "Muzyka", categoryId: SUB, expectedAmount: g(2_300), ...change }),
      ];

      expect(overview({ expenses: spotify, rules }).detected).toHaveLength(1);
    });
  });

  it("„To nie subskrypcja” → klucz odrzucony, więcej nie podpowiada", () => {
    const { detected } = overview({
      expenses: spotify,
      dismissedKeys: ["n|cat-subscriptions|spotify"],
    });

    expect(detected).toEqual([]);
  });
});

describe("subscriptionsOverview — potwierdzone i sumy", () => {
  const netflix = rule({
    id: "rule-netflix",
    name: "Netflix",
    categoryId: SUB,
    expectedAmount: g(4_900),
    isSubscription: true,
  });
  const domain = rule({
    id: "rule-domain",
    name: "Domena",
    categoryId: SUB,
    frequency: "YEARLY",
    expectedAmount: g(9_900),
    isSubscription: true,
  });

  it("potwierdzone to reguły oznaczone jako subskrypcja; czynsz się nie liczy", () => {
    const result = overview({ rules: [rule(), netflix, domain] });

    expect(result.confirmed).toEqual([
      {
        ruleId: "rule-netflix",
        name: "Netflix",
        categoryId: SUB,
        frequency: "MONTHLY",
        interval: 1,
        amount: 4_900,
        monthly: 4_900,
        yearly: 58_800,
        priceChange: null,
      },
      expect.objectContaining({ ruleId: "rule-domain", monthly: 825, yearly: 9_900 }),
    ]);
  });

  it("suma główna tylko z potwierdzonych; wykryte osobno („+ 1 do sprawdzenia”)", () => {
    const result = overview({ rules: [rule(), netflix, domain], expenses: spotify });

    expect(result.totals).toEqual({
      // 49 zł × 12 + 99 zł = 687 zł rocznie → 57,25 zł miesięcznie.
      confirmed: { count: 2, monthly: 5_725, yearly: 68_700 },
      detected: { count: 1, monthly: 2_300, yearly: 27_600 },
    });
  });

  it("miesięczna suma z sumy rocznej (w górę), nie z zaokrąglonych pozycji", () => {
    // Trzy razy 10 zł co tydzień: 3 × 520 zł = 1560 zł rocznie = dokładnie 130 zł/mies.
    // Suma zaokrąglonych pozycji dałaby 3 × 43,34 zł = 130,02 zł.
    const weekly = (id: string) =>
      rule({ id, name: id, frequency: "WEEKLY", expectedAmount: g(1_000), isSubscription: true });

    expect(overview({ rules: [weekly("a"), weekly("b"), weekly("c")] }).totals.confirmed).toEqual({
      count: 3,
      monthly: 13_000,
      yearly: 156_000,
    });
  });

  it("pusto → zera", () => {
    expect(overview({}).totals).toEqual({
      confirmed: { count: 0, monthly: 0, yearly: 0 },
      detected: { count: 0, monthly: 0, yearly: 0 },
    });
  });

  it("podwyżka potwierdzonej subskrypcji z płatności „Inna kwota”", () => {
    const withPayments = {
      ...netflix,
      payments: [
        { date: d("2026-08-10"), amount: g(4_300) },
        { date: d("2026-09-10"), amount: g(4_300) },
        { date: d("2026-10-10"), amount: g(4_900) },
      ],
    };

    expect(overview({ rules: [withPayments] }).confirmed[0]?.priceChange).toEqual({
      from: 4_300,
      to: 4_900,
      since: "2026-10-10",
      yearlyDelta: 7_200,
    });
  });

  it("potwierdzone od najdroższej miesięcznie", () => {
    const cheap = { ...netflix, id: "rule-cheap", name: "Tani", expectedAmount: g(500) };

    expect(overview({ rules: [cheap, netflix] }).confirmed.map((item) => item.name)).toEqual([
      "Netflix",
      "Tani",
    ]);
  });
});
