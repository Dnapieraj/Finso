import { Logger } from "@nestjs/common";

import type { MailMessage, Mailer } from "./mailer.js";

/**
 * Lokalnie i w testach: e-mail trafia do logu serwera, kod da się z niego
 * przepisać. Produkcja bez klucza Resend nie wystartuje (src/config/env.ts).
 */
export class LogMailer implements Mailer {
  private readonly logger = new Logger("Mail");

  send(message: MailMessage): Promise<void> {
    this.logger.log(`To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`);
    return Promise.resolve();
  }
}
