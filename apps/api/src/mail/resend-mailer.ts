import type { MailMessage, Mailer } from "./mailer.js";

/**
 * Wysyłka przez API HTTP Resend — bez SDK, to jedno żądanie. `fetch`
 * wstrzykiwany, żeby test sprawdził żądanie bez sieci.
 */
export class ResendMailer implements Mailer {
  constructor(
    private readonly options: {
      apiKey: string;
      from: string;
      fetch?: typeof globalThis.fetch;
    },
  ) {}

  async send(message: MailMessage): Promise<void> {
    const fetch = this.options.fetch ?? globalThis.fetch;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!response.ok) throw new Error(`Resend responded ${String(response.status)}`);
  }
}
