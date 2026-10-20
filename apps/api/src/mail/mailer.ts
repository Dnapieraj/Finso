/** Jedna wiadomość: zwykły tekst, bez HTML — kod da się przeczytać w każdym kliencie poczty. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Wysyłka e-maili. Rzuca, gdy wiadomość nie wyszła — o skutkach decyduje wywołujący. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export const MAILER = Symbol("MAILER");
