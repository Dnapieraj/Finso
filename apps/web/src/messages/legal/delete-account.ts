import { contactEmail } from "@/content/site";

import type { LegalDocument } from "./types";

const DELETION_SUBJECT = "Usunięcie konta";

/**
 * Google Play requires a web page where users can request account deletion
 * without the app. The steps mirror DELETE /users/me, which asks for the
 * password and cascades to every record owned by the user.
 */
export const deleteAccount = {
  title: "Usuwanie konta",
  description:
    "Jak usunąć konto w aplikacji Finso razem ze wszystkimi danymi — w aplikacji albo mailowo, bez instalowania aplikacji.",
  updated: { iso: "2026-09-24", label: "24 września 2026" },
  intro: [
    "Konto w aplikacji Finso (iOS i Android) możesz usunąć w każdej chwili. Są dwie drogi — wybierz tę, która ci pasuje.",
  ],
  sections: [
    {
      id: "w-aplikacji",
      title: "W aplikacji",
      blocks: [
        {
          type: "ol",
          items: [
            ["Otwórz aplikację Finso i przejdź do zakładki Ustawienia."],
            ["Wybierz Usuń konto."],
            ["Potwierdź hasłem. Konto i wszystkie dane zostaną usunięte od razu."],
          ],
        },
      ],
    },
    {
      id: "bez-aplikacji",
      title: "Bez aplikacji",
      blocks: [
        {
          type: "p",
          text: [
            "Jeśli nie masz już dostępu do aplikacji, napisz na ",
            {
              href: `mailto:${contactEmail}?subject=${encodeURIComponent(DELETION_SUBJECT)}`,
              text: contactEmail,
            },
            ` z adresu e-mail przypisanego do konta, z tematem „${DELETION_SUBJECT}”. Usuniemy konto w ciągu 30 dni i potwierdzimy to mailowo.`,
          ],
        },
        {
          type: "p",
          text: [
            "Jeśli piszesz z innego adresu, najpierw poprosimy o potwierdzenie, że konto należy do ciebie — żeby nikt nie usunął cudzego konta.",
          ],
        },
      ],
    },
    {
      id: "dane",
      title: "Jakie dane usuwamy",
      blocks: [
        {
          type: "p",
          text: ["Usuwamy wszystkie dane powiązane z kontem:"],
        },
        {
          type: "ul",
          items: [
            ["adres e-mail i skrót hasła,"],
            ["wydatki i wpływy, także te przeniesione do kosza,"],
            ["źródła dochodu, stałe zobowiązania, cele oszczędnościowe i własne kategorie,"],
            ["ustawienia i aktywne sesje logowania na wszystkich urządzeniach."],
          ],
        },
        {
          type: "p",
          text: [
            "Nie zatrzymujemy żadnych danych konta. Z kopii zapasowych bazy danych znikają najpóźniej po 30 dniach.",
          ],
        },
      ],
    },
    {
      id: "subskrypcja",
      title: "Subskrypcja Plus",
      blocks: [
        {
          type: "p",
          text: [
            "Usunięcie konta nie anuluje subskrypcji. Jeśli masz Finso Plus, najpierw anuluj ją w ustawieniach subskrypcji App Store (iPhone) lub Google Play (Android) — inaczej sklep będzie dalej pobierał opłaty.",
          ],
        },
      ],
    },
  ],
} as const satisfies LegalDocument;
