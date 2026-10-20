import type { MailMessage } from "./mailer.js";

// Treści e-maili po polsku, w jednym miejscu (jak teksty UI w appce).
// Neutralne formy — appka nie zna płci użytkownika.

/** Kod do ustawienia nowego hasła. */
export function passwordResetMail(to: string, code: string): MailMessage {
  return {
    to,
    subject: "Kod do zmiany hasła w Finso",
    text: [
      `Twój kod: ${code}`,
      "",
      "Wpisz go w aplikacji Finso, żeby ustawić nowe hasło. Kod jest ważny 15 minut.",
      "",
      "Jeśli to nie Ty prosisz o zmianę hasła, zignoruj tę wiadomość — hasło się nie zmieni.",
    ].join("\n"),
  };
}

/** Kod potwierdzający adres e-mail. */
export function emailVerificationMail(to: string, code: string): MailMessage {
  return {
    to,
    subject: "Potwierdź adres e-mail w Finso",
    text: [
      `Twój kod: ${code}`,
      "",
      "Wpisz go w aplikacji Finso, żeby potwierdzić adres e-mail. Kod jest ważny 24 godziny.",
      "",
      "Na ten adres wyślemy kod, gdy zapomnisz hasła. Jeśli to nie Ty zakładasz konto, zignoruj tę wiadomość.",
    ].join("\n"),
  };
}
