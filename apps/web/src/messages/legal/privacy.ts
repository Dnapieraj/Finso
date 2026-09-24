import { legalLinks } from "@/content/links";
import { contactEmail, dataController } from "@/content/site";

import type { LegalDocument } from "./types";

const mail = { href: `mailto:${contactEmail}`, text: contactEmail };

/** Draft for legal review before publishing. Describes only what the code does today. */
export const privacyPolicy = {
  title: "Polityka prywatności",
  description:
    "Jakie dane zbiera aplikacja Finso, w jakim celu, komu je przekazujemy, jak długo je przechowujemy i jakie masz prawa.",
  updated: { iso: "2026-09-24", label: "24 września 2026" },
  intro: [
    "Ta polityka opisuje, jak aplikacja mobilna Finso i ta strona przetwarzają dane osobowe. Staramy się pisać prosto i konkretnie.",
  ],
  sections: [
    {
      id: "administrator",
      title: "Administrator danych",
      blocks: [
        {
          type: "p",
          text: [
            `Administratorem danych osobowych jest ${dataController}. W sprawach dotyczących twoich danych napisz na `,
            mail,
            ".",
          ],
        },
      ],
    },
    {
      // TODO: update this list and "odbiorcy" when receipt photos
      // (Transaction.receiptUrl + file storage) or Google/Apple sign-in ship.
      id: "dane",
      title: "Jakie dane zbieramy",
      blocks: [
        {
          type: "ul",
          items: [
            [
              "Dane konta: adres e-mail i hasło. Hasła nie przechowujemy wprost — zapisujemy tylko jego skrót (hash) wyliczony algorytmem argon2.",
            ],
            [
              "Dane finansowe, które sam wpisujesz: wydatki i wpływy (kwota, data, kategoria, notatka), źródła dochodu, stałe zobowiązania i cele oszczędnościowe.",
            ],
            [
              "Ustawienia: waluta, strefa czasowa i dzień miesiąca, od którego liczy się twój okres budżetowy.",
            ],
            [
              "Status subskrypcji: plan (Free lub Plus) i identyfikator klienta w RevenueCat. Danych karty płatniczej nie widzimy — płatność obsługuje App Store lub Google Play.",
            ],
            [
              "Dane sesji: skróty tokenów logowania i ich daty ważności, żeby utrzymać cię zalogowanym i móc unieważnić sesję.",
            ],
          ],
        },
        {
          type: "p",
          text: [
            "Finso nie łączy się z twoim bankiem i nie pobiera historii rachunku. Wszystkie dane finansowe pochodzą od ciebie.",
          ],
        },
      ],
    },
    {
      id: "biometria",
      title: "Logowanie biometryczne",
      blocks: [
        {
          type: "p",
          text: [
            "Jeśli włączysz logowanie odciskiem palca lub twarzą, sprawdza je system telefonu (Face ID, Touch ID lub biometria Androida). Finso dostaje tylko odpowiedź, czy weryfikacja się udała, i nie zbiera danych biometrycznych.",
          ],
        },
      ],
    },
    {
      id: "cele",
      title: "Do czego używamy danych",
      blocks: [
        {
          type: "ul",
          items: [
            [
              "Prowadzenie konta i działanie aplikacji: wyliczanie budżetu, symulacje zakupów, cele oszczędnościowe (art. 6 ust. 1 lit. b RODO — wykonanie umowy).",
            ],
            ["Obsługa subskrypcji Plus (art. 6 ust. 1 lit. b RODO — wykonanie umowy)."],
            [
              "Bezpieczeństwo: ochrona przed przejęciem konta i nadużyciami, np. limit prób logowania (art. 6 ust. 1 lit. f RODO — prawnie uzasadniony interes).",
            ],
            [
              "Wypełnianie obowiązków prawnych, jeśli przepisy ich od nas wymagają (art. 6 ust. 1 lit. c RODO).",
            ],
          ],
        },
        {
          type: "p",
          text: [
            "Nie sprzedajemy danych, nie używamy ich do reklam i nie profilujemy cię w celach marketingowych.",
          ],
        },
      ],
    },
    {
      id: "odbiorcy",
      title: "Komu przekazujemy dane",
      blocks: [
        {
          type: "p",
          text: ["Dane przekazujemy tylko podmiotom, bez których aplikacja nie mogłaby działać:"],
        },
        {
          type: "ul",
          items: [
            [
              "RevenueCat, Inc. — obsługa i weryfikacja subskrypcji Plus. Otrzymuje identyfikator klienta i informacje o zakupach.",
            ],
            [
              "Apple (App Store) i Google (Google Play) — dystrybucja aplikacji i płatności za subskrypcję. Zakup odbywa się na twoim koncie w sklepie, na zasadach sklepu.",
            ],
            [
              "Dostawca hostingu, na którego serwerach w Unii Europejskiej działa baza danych Finso.",
            ],
          ],
        },
        {
          type: "p",
          text: [
            "RevenueCat, Apple i Google mogą przetwarzać dane poza Europejskim Obszarem Gospodarczym, m.in. w USA. Przekazanie odbywa się na podstawie decyzji Komisji Europejskiej (EU-US Data Privacy Framework) lub standardowych klauzul umownych.",
          ],
        },
      ],
    },
    {
      id: "przechowywanie",
      title: "Jak długo przechowujemy dane",
      blocks: [
        {
          type: "ul",
          items: [
            [
              "Dane konta i dane finansowe — dopóki masz konto. Po usunięciu konta usuwamy je z bazy danych od razu.",
            ],
            [
              "Wpisy przeniesione do kosza (np. usunięty wydatek) zostają na koncie, żeby dało się je przywrócić, i znikają razem z kontem.",
            ],
            [
              "Kopie zapasowe bazy danych — dane usuniętego konta znikają z nich najpóźniej po 30 dniach, gdy kopie zostaną nadpisane.",
            ],
          ],
        },
      ],
    },
    {
      id: "prawa",
      title: "Twoje prawa",
      blocks: [
        {
          type: "p",
          text: ["Masz prawo do:"],
        },
        {
          type: "ul",
          items: [
            ["dostępu do swoich danych i otrzymania ich kopii,"],
            ["sprostowania danych — większość z nich poprawisz sam w aplikacji,"],
            [
              "usunięcia danych — instrukcja jest na stronie ",
              { href: legalLinks.deleteAccount, text: "Usuwanie konta" },
              ",",
            ],
            ["przeniesienia danych, ograniczenia przetwarzania i sprzeciwu wobec przetwarzania."],
          ],
        },
        {
          type: "p",
          text: ["Żeby skorzystać z tych praw, napisz na ", mail, ". Odpowiemy w ciągu miesiąca."],
        },
        {
          type: "p",
          text: [
            "Masz też prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "Pliki cookies",
      blocks: [
        {
          type: "p",
          text: [
            "Ta strona nie używa plików cookies ani narzędzi analitycznych. Aplikacja mobilna przechowuje tokeny logowania w bezpiecznym magazynie systemu telefonu (Keychain w iOS, Keystore w Androidzie).",
          ],
        },
      ],
    },
    {
      id: "zmiany",
      title: "Zmiany polityki",
      blocks: [
        {
          type: "p",
          text: [
            "O istotnych zmianach poinformujemy w aplikacji, zanim wejdą w życie. Datę ostatniej aktualizacji znajdziesz na górze tej strony.",
          ],
        },
      ],
    },
  ],
} as const satisfies LegalDocument;
