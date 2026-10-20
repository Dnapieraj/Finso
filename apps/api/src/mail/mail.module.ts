import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../config/env.js";
import { LogMailer } from "./log-mailer.js";
import { MAILER } from "./mailer.js";
import { ResendMailer } from "./resend-mailer.js";

@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = config.get("RESEND_API_KEY", { infer: true });
        return apiKey === undefined
          ? new LogMailer()
          : new ResendMailer({ apiKey, from: config.get("MAIL_FROM", { infer: true }) });
      },
    },
  ],
  exports: [MAILER],
})
export class MailModule {}
