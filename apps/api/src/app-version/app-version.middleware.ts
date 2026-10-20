import { Injectable, type NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_VERSION_HEADER, isOlderVersion } from "@vireo/shared";
import type { NextFunction, Request, Response } from "express";

import type { Env } from "../config/env.js";

/** HTTP 426 Upgrade Required — Nest nie ma go w enumie HttpStatus. */
const UPGRADE_REQUIRED = 426;

/**
 * Zbyt stara appka (nagłówek X-App-Version poniżej MIN_APP_VERSION) dostaje
 * 426 na każde żądanie — także publiczne, przed sprawdzeniem tokena — i
 * pokazuje „Zaktualizuj aplikację”. Bez nagłówka albo z nieczytelnym
 * przepuszcza: pomyłka w wersji nie może odciąć użytkownika od danych.
 */
@Injectable()
export class AppVersionMiddleware implements NestMiddleware {
  private readonly minimum: string;

  constructor(config: ConfigService<Env, true>) {
    this.minimum = config.get("MIN_APP_VERSION", { infer: true });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const version = req.header(APP_VERSION_HEADER);
    if (version !== undefined && isOlderVersion(version, this.minimum)) {
      res.status(UPGRADE_REQUIRED).json({
        statusCode: UPGRADE_REQUIRED,
        message: "update_required",
        minimumVersion: this.minimum,
      });
      return;
    }
    next();
  }
}
