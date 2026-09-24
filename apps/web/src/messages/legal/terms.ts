import { legalLinks } from "@/content/links";
import { contactEmail, dataController } from "@/content/site";

import type { LegalDocument } from "./types";

const mail = { href: `mailto:${contactEmail}`, text: contactEmail };

/** Draft for legal review before publishing. */
export const termsOfService = {
  title: "Regulamin",
  description:
    "Zasady korzystania z aplikacji Finso: konto, plany Free i Plus, płatności przez App Store i Google Play, odpowiedzialność i usuwanie konta.",
  updated: { iso: "2026-09-24", label: "24 września 2026" },
  intro: [
    "Regulamin określa zasady korzystania z aplikacji mobilnej Finso na iOS i Androida (dalej: aplikacja).",
  ],
  sections: [
    {
      id: "postanowienia-ogolne",
      title: "Postanowienia ogólne",
      blocks: [
        {
          type: "p",
          text: [`Usługodawcą jest ${dataController}. Kontakt: `, mail, "."],
        },
        {
          type: "p",
          text: [
            "Zakładając konto, akceptujesz ten regulamin. Zasady przetwarzania danych opisuje dokument ",
            { href: legalLinks.privacy, text: "Polityka prywatności" },
            ".",
          ],
        },
      ],
    },
    {
      id: "usluga",
      title: "Czym jest Finso",
      blocks: [
        {
          type: "p",
          text: [
            "Finso pomaga planować wydatki. Na podstawie wpisanych przez ciebie dochodów, zobowiązań i celów wylicza, ile możesz wydać, i pokazuje, jak planowany zakup wpłynie na twój budżet.",
          ],
        },
      ],
    },
    {
      id: "konto",
      title: "Konto",
      blocks: [
        {
          type: "ul",
          items: [
            ["Do korzystania z aplikacji potrzebne jest konto założone na adres e-mail i hasło."],
            [
              "Odpowiadasz za poufność hasła. Jeśli podejrzewasz, że ktoś uzyskał dostęp do twojego konta, napisz na ",
              mail,
              ".",
            ],
            ["Wyliczenia zależą od danych, które wpisujesz — im dokładniejsze, tym trafniejsze."],
          ],
        },
      ],
    },
    {
      id: "plany",
      title: "Plany Free i Plus",
      blocks: [
        {
          type: "p",
          text: [
            "Plan Free jest bezpłatny i bezterminowy. Plan Plus to płatna subskrypcja miesięczna lub roczna, która odblokowuje dodatkowe funkcje. Aktualny zakres planów i ceny znajdziesz w aplikacji i w ",
            { href: "/#cennik", text: "cenniku" },
            ".",
          ],
        },
      ],
    },
    {
      id: "platnosci",
      title: "Płatności i anulowanie",
      blocks: [
        {
          type: "ul",
          items: [
            [
              "Subskrypcję Plus kupujesz wyłącznie w aplikacji, przez App Store (iOS) lub Google Play (Android). Płatność, rachunki i zwroty obsługuje sklep na swoich zasadach.",
            ],
            ["Subskrypcja odnawia się automatycznie na kolejny okres, dopóki jej nie anulujesz."],
            [
              "Subskrypcję anulujesz w ustawieniach subskrypcji swojego konta Apple lub Google. Plus działa do końca opłaconego okresu.",
            ],
            [
              "Usunięcie konta w Finso nie anuluje subskrypcji w sklepie — trzeba ją anulować osobno.",
            ],
          ],
        },
      ],
    },
    {
      id: "wyliczenia",
      title: "Charakter wyliczeń",
      blocks: [
        {
          type: "p",
          text: [
            "Wyliczenia, symulacje i prognozy Finso są szacunkami opartymi na danych, które wprowadzasz, i nie stanowią porady finansowej, inwestycyjnej ani podatkowej. Decyzje finansowe podejmujesz samodzielnie.",
          ],
        },
      ],
    },
    {
      id: "odpowiedzialnosc",
      title: "Odpowiedzialność",
      blocks: [
        {
          type: "p",
          text: [
            "Dbamy o to, żeby aplikacja działała poprawnie i bez przerw, ale mogą zdarzyć się przerwy techniczne. Nie odpowiadamy za skutki decyzji finansowych podjętych na podstawie wyliczeń ani za skutki wpisania błędnych danych. Te postanowienia nie ograniczają praw, które konsumentom przysługują z mocy prawa.",
          ],
        },
      ],
    },
    {
      id: "reklamacje",
      title: "Reklamacje",
      blocks: [
        {
          type: "p",
          text: [
            "Reklamacje dotyczące działania aplikacji wyślij na ",
            mail,
            ". Odpowiemy w ciągu 14 dni. Reklamacje płatności rozpatruje sklep, w którym kupiono subskrypcję.",
          ],
        },
      ],
    },
    {
      id: "usuniecie-konta",
      title: "Usunięcie konta",
      blocks: [
        {
          type: "p",
          text: [
            "Konto możesz usunąć w każdej chwili, w aplikacji albo mailowo. Instrukcja jest na stronie ",
            { href: legalLinks.deleteAccount, text: "Usuwanie konta" },
            ". Usunięcie konta kończy umowę o świadczenie usług.",
          ],
        },
      ],
    },
    {
      id: "zmiany",
      title: "Zmiany regulaminu",
      blocks: [
        {
          type: "p",
          text: [
            "O zmianach regulaminu poinformujemy w aplikacji co najmniej 14 dni przed ich wejściem w życie. Jeśli się z nimi nie zgadzasz, możesz usunąć konto.",
          ],
        },
      ],
    },
    {
      id: "prawo",
      title: "Prawo właściwe",
      blocks: [
        {
          type: "p",
          text: [
            "Regulamin podlega prawu polskiemu. Nie odbiera to konsumentom ochrony, którą dają im przepisy kraju ich zwykłego pobytu.",
          ],
        },
      ],
    },
  ],
} as const satisfies LegalDocument;
