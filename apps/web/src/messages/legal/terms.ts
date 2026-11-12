import { legalLinks } from "@/content/links";
import { contactEmail, dataController } from "@/content/site";

import type { LegalDocument } from "./types";

const mail = { href: `mailto:${contactEmail}`, text: contactEmail };

/** Draft for legal review before publishing. */
export const termsOfService = {
  title: "Regulamin",
  description:
    "Zasady korzystania z aplikacji Finso: konto, jednorazowy zakup w App Store i Google Play, odpowiedzialność i usuwanie konta.",
  updated: { iso: "2026-11-12", label: "12 listopada 2026" },
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
      id: "cena",
      title: "Cena i zakup",
      blocks: [
        {
          type: "ul",
          items: [
            [
              "Aplikacja jest płatna jednorazowo przy pobraniu z App Store (iOS) lub Google Play (Android). Aktualną cenę pokazuje sklep i ",
              { href: "/#cennik", text: "cennik" },
              ".",
            ],
            [
              "Nie ma planów, subskrypcji ani płatności wewnątrz aplikacji — po zakupie masz wszystkie funkcje i kolejne aktualizacje bez dodatkowych opłat.",
            ],
            [
              "Płatność, rachunki i zwroty obsługuje sklep na swoich zasadach. Zakup w jednym sklepie nie obejmuje aplikacji w drugim (np. kupionej w Google Play na iPhonie).",
            ],
            [
              "Usunięcie konta w Finso nie zwraca opłaty za aplikację. Aplikacja zostaje na twoim koncie w sklepie, więc możesz ją pobrać ponownie bez płacenia.",
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
            ". Odpowiemy w ciągu 14 dni. Reklamacje płatności rozpatruje sklep, w którym kupiono aplikację.",
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
